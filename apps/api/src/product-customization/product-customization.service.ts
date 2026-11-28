import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CustomizationFieldType,
  Prisma,
  UploadedAsset,
  UploadOwnerType,
} from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { decimal, MoneyInput } from '../common/utils/money.util';
import {
  CreateFieldDto,
  CreateSchemaDto,
  SchemaQueryDto,
  UpdateFieldDto,
  UpdateSchemaDto,
} from './dto/customization.dto';

/** The shape consumed by the cart/checkout pricing contract. */
export interface CustomizationDefinition {
  key: string;
  type: CustomizationFieldType;
  label: string;
  isRequired: boolean;
  options: unknown;
  validation: unknown;
  priceDelta: Prisma.Decimal;
}

export interface CustomizationDefinitionInput {
  fieldKey: string;
  value: unknown;
}

export interface PricedCustomizationValue {
  fieldKey: string;
  value: unknown;
  label?: string;
}

export interface PricedCustomization {
  values: PricedCustomizationValue[];
  extra: Prisma.Decimal;
  assetIds: string[];
}

export interface ResolvedDefinition extends CustomizationDefinition {
  schemaId: string;
  schemaName: string;
  description: string | null;
  placeholder: string | null;
}

interface ParsedOption {
  value: string;
  label: string;
  priceDelta: Prisma.Decimal;
}

interface ParsedValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  accept?: string[];
  maxBytes?: number;
}

const finiteNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

function mimeMatches(mimeType: string, pattern: string): boolean {
  const normalized = pattern.trim().toLowerCase();
  if (normalized.endsWith('/*')) return mimeType.toLowerCase().startsWith(normalized.slice(0, -1));
  return mimeType.toLowerCase() === normalized;
}

@Injectable()
export class CustomizationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validates customer-supplied customization values against server-side
   * definitions and computes the extra charge. No client-provided price is
   * ever used: option and field deltas come from the stored definitions.
   */
  async validateAndPrice(
    definitions: CustomizationDefinition[],
    values: CustomizationDefinitionInput[],
    uploadedAssetIds: string[],
  ): Promise<PricedCustomization> {
    if (!Array.isArray(definitions)) throw new BadRequestException('Invalid customization definitions');
    const suppliedValues = Array.isArray(values) ? values : [];
    const suppliedAssetIds = Array.isArray(uploadedAssetIds) ? uploadedAssetIds : [];

    const byKey = new Map<string, unknown>();
    for (const value of suppliedValues) {
      if (!value || typeof value.fieldKey !== 'string') {
        throw new BadRequestException('Invalid customization value');
      }
      if (byKey.has(value.fieldKey)) {
        throw new BadRequestException(`Duplicate customization value: ${value.fieldKey}`);
      }
      byKey.set(value.fieldKey, value.value);
    }

    const assetRows = await this.loadAssets(suppliedAssetIds);
    const assetById = new Map(assetRows.map((asset) => [asset.id, asset]));
    const usedAssetIds = new Set<string>();
    const handledKeys = new Set<string>();
    const resultValues: PricedCustomizationValue[] = [];
    let extra = decimal(0);

    for (const definition of definitions) {
      handledKeys.add(definition.key);
      const rawValue = byKey.get(definition.key);
      if (rawValue === undefined || rawValue === null || rawValue === '') {
        if (definition.isRequired) {
          throw new BadRequestException(`${definition.label} is required`);
        }
        continue;
      }

      const options = this.parseOptions(definition.options);
      const validation = this.parseValidation(definition.validation);
      let outputValue: unknown = rawValue;
      let label: string | undefined;

      switch (definition.type) {
        case CustomizationFieldType.TEXT:
        case CustomizationFieldType.TEXTAREA: {
          if (typeof rawValue !== 'string') {
            throw new BadRequestException(`${definition.label} must be text`);
          }
          if (validation.minLength !== undefined && rawValue.length < validation.minLength) {
            throw new BadRequestException(`${definition.label} is too short`);
          }
          if (validation.maxLength !== undefined && rawValue.length > validation.maxLength) {
            throw new BadRequestException(`${definition.label} is too long`);
          }
          if (validation.pattern) {
            let pattern: RegExp;
            try {
              pattern = new RegExp(validation.pattern);
            } catch {
              throw new BadRequestException(`${definition.label} has an invalid pattern`);
            }
            if (!pattern.test(rawValue)) {
              throw new BadRequestException(`${definition.label} has an invalid format`);
            }
          }
          break;
        }
        case CustomizationFieldType.NUMBER: {
          const numeric = typeof rawValue === 'number' ? rawValue : Number(rawValue);
          if (!Number.isFinite(numeric)) {
            throw new BadRequestException(`${definition.label} must be a number`);
          }
          if (validation.min !== undefined && numeric < validation.min) {
            throw new BadRequestException(`${definition.label} is below the allowed minimum`);
          }
          if (validation.max !== undefined && numeric > validation.max) {
            throw new BadRequestException(`${definition.label} is above the allowed maximum`);
          }
          outputValue = numeric;
          break;
        }
        case CustomizationFieldType.BOOLEAN: {
          if (typeof rawValue !== 'boolean') {
            throw new BadRequestException(`${definition.label} must be true or false`);
          }
          break;
        }
        case CustomizationFieldType.SINGLE_SELECT:
        case CustomizationFieldType.DROPDOWN:
        case CustomizationFieldType.COLOR: {
          if (typeof rawValue !== 'string') {
            throw new BadRequestException(`${definition.label} must be a single option`);
          }
          const option = options.find((candidate) => candidate.value === rawValue);
          if (!option) throw new BadRequestException(`Invalid option selected for ${definition.label}`);
          extra = extra.plus(option.priceDelta);
          label = option.label;
          break;
        }
        case CustomizationFieldType.MULTI_SELECT: {
          if (!Array.isArray(rawValue)) {
            throw new BadRequestException(`${definition.label} must be a list of options`);
          }
          const selected = rawValue.map((item) => String(item));
          if (selected.length === 0 && definition.isRequired) {
            throw new BadRequestException(`${definition.label} is required`);
          }
          if (new Set(selected).size !== selected.length) {
            throw new BadRequestException(`${definition.label} contains duplicate options`);
          }
          if (
            (validation.min !== undefined && selected.length < validation.min) ||
            (validation.max !== undefined && selected.length > validation.max)
          ) {
            throw new BadRequestException(`Invalid number of options selected for ${definition.label}`);
          }
          const labels: string[] = [];
          for (const value of selected) {
            const option = options.find((candidate) => candidate.value === value);
            if (!option) throw new BadRequestException(`Invalid option selected for ${definition.label}`);
            extra = extra.plus(option.priceDelta);
            labels.push(option.label);
          }
          outputValue = selected;
          label = labels.join(', ');
          break;
        }
        case CustomizationFieldType.IMAGE: {
          const ids = Array.isArray(rawValue) ? rawValue.map((item) => String(item)) : [String(rawValue)];
          if (ids.length === 0) throw new BadRequestException(`No image supplied for ${definition.label}`);
          if (
            (validation.min !== undefined && ids.length < validation.min) ||
            (validation.max !== undefined && ids.length > validation.max)
          ) {
            throw new BadRequestException(`Invalid number of images for ${definition.label}`);
          }
          for (const id of ids) {
            const asset = assetById.get(id);
            if (!asset || !suppliedAssetIds.includes(id)) {
              throw new BadRequestException(`Invalid image supplied for ${definition.label}`);
            }
            if (
              validation.accept?.length &&
              !validation.accept.some((pattern) => mimeMatches(asset.mimeType, pattern))
            ) {
              throw new BadRequestException(`Unsupported image type for ${definition.label}`);
            }
            if (validation.maxBytes !== undefined && asset.sizeBytes > validation.maxBytes) {
              throw new BadRequestException(`Image is too large for ${definition.label}`);
            }
            usedAssetIds.add(id);
          }
          outputValue = Array.isArray(rawValue) ? ids : ids[0];
          break;
        }
        default:
          throw new BadRequestException(`Unsupported customization field type: ${String(definition.type)}`);
      }

      // The field-level delta is charged once when the field is filled.
      extra = extra.plus(decimal(definition.priceDelta));
      resultValues.push(
        label === undefined
          ? { fieldKey: definition.key, value: outputValue }
          : { fieldKey: definition.key, value: outputValue, label },
      );
    }

    for (const key of byKey.keys()) {
      if (!handledKeys.has(key)) throw new BadRequestException(`Unknown customization field: ${key}`);
    }

    return { values: resultValues, extra, assetIds: [...usedAssetIds] };
  }

  /** All product-level and category-level definitions that apply to a product. */
  async resolveSchemas(productId: string, categoryId?: string): Promise<ResolvedDefinition[]> {
    const schemas = await this.prisma.productCustomizationSchema.findMany({
      where: {
        OR: [{ productId }, ...(categoryId ? [{ categoryId }] : [])],
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      include: { fields: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] } },
    });

    return schemas.flatMap((schema) =>
      schema.fields.map((field) => ({
        key: field.key,
        type: field.type,
        label: field.label,
        isRequired: field.isRequired,
        options: field.options,
        validation: field.validation,
        priceDelta: field.priceDelta,
        schemaId: schema.id,
        schemaName: schema.name,
        description: field.description,
        placeholder: field.placeholder,
      })),
    );
  }

  // ---------------------------------------------------------------------------
  // Schema / field CRUD
  // ---------------------------------------------------------------------------

  listSchemas(query: SchemaQueryDto) {
    const where: Prisma.ProductCustomizationSchemaWhereInput = {
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    };
    return this.prisma.productCustomizationSchema.findMany({
      where,
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      include: { fields: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] } },
    });
  }

  async getSchema(id: string) {
    const schema = await this.prisma.productCustomizationSchema.findUnique({
      where: { id },
      include: { fields: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] } },
    });
    if (!schema) throw new NotFoundException('Customization schema not found');
    return schema;
  }

  async createSchema(dto: CreateSchemaDto) {
    await this.validateSchemaTarget(dto.productId, dto.categoryId);
    return this.prisma.productCustomizationSchema.create({
      data: {
        productId: dto.productId ?? null,
        categoryId: dto.categoryId ?? null,
        name: dto.name.trim(),
        description: dto.description,
        isRequired: dto.isRequired ?? false,
        position: dto.position ?? 0,
      },
    });
  }

  async updateSchema(id: string, dto: UpdateSchemaDto) {
    const existing = await this.getSchema(id);
    const productId = dto.productId === undefined ? existing.productId : dto.productId;
    const categoryId = dto.categoryId === undefined ? existing.categoryId : dto.categoryId;
    await this.validateSchemaTarget(productId, categoryId);

    return this.prisma.productCustomizationSchema.update({
      where: { id },
      data: {
        productId,
        categoryId,
        name: dto.name?.trim(),
        description: dto.description,
        isRequired: dto.isRequired,
        position: dto.position,
      },
    });
  }

  async deleteSchema(id: string): Promise<void> {
    await this.getSchema(id);
    await this.prisma.productCustomizationSchema.delete({ where: { id } });
  }

  async createField(schemaId: string, dto: CreateFieldDto) {
    await this.getSchema(schemaId);
    return this.prisma.productCustomizationField.create({
      data: {
        schemaId,
        key: dto.key.trim(),
        label: dto.label.trim(),
        type: dto.type,
        description: dto.description,
        placeholder: dto.placeholder,
        isRequired: dto.isRequired ?? false,
        position: dto.position ?? 0,
        options: (dto.options ?? []) as Prisma.InputJsonValue,
        validation: (dto.validation ?? {}) as Prisma.InputJsonValue,
        priceDelta: decimal(dto.priceDelta ?? 0),
      },
    });
  }

  async updateField(id: string, dto: UpdateFieldDto) {
    const existing = await this.prisma.productCustomizationField.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Customization field not found');

    return this.prisma.productCustomizationField.update({
      where: { id },
      data: {
        key: dto.key?.trim(),
        label: dto.label?.trim(),
        type: dto.type,
        description: dto.description,
        placeholder: dto.placeholder,
        isRequired: dto.isRequired,
        position: dto.position,
        ...(dto.options ? { options: dto.options as Prisma.InputJsonValue } : {}),
        ...(dto.validation ? { validation: dto.validation as Prisma.InputJsonValue } : {}),
        priceDelta: dto.priceDelta !== undefined ? decimal(dto.priceDelta) : undefined,
      },
    });
  }

  async deleteField(id: string): Promise<void> {
    const field = await this.prisma.productCustomizationField.findUnique({ where: { id } });
    if (!field) throw new NotFoundException('Customization field not found');
    await this.prisma.productCustomizationField.delete({ where: { id } });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async validateSchemaTarget(productId?: string | null, categoryId?: string | null): Promise<void> {
    if (Boolean(productId) === Boolean(categoryId)) {
      throw new BadRequestException('Exactly one of productId or categoryId is required');
    }
    if (productId) {
      const product = await this.prisma.product.findFirst({
        where: { id: productId, deletedAt: null },
        select: { id: true },
      });
      if (!product) throw new BadRequestException('Product not found');
    }
    if (categoryId) {
      const category = await this.prisma.category.findFirst({
        where: { id: categoryId, deletedAt: null },
        select: { id: true },
      });
      if (!category) throw new BadRequestException('Category not found');
    }
  }

  private async loadAssets(ids: string[]): Promise<UploadedAsset[]> {
    if (ids.length === 0) return [];
    const assets = await this.prisma.uploadedAsset.findMany({
      where: { id: { in: [...new Set(ids)] }, ownerType: UploadOwnerType.CUSTOMIZATION },
    });
    if (assets.length !== new Set(ids).size) {
      throw new BadRequestException('One or more uploaded images are invalid');
    }
    return assets;
  }

  private parseOptions(raw: unknown): ParsedOption[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((item) => ({
        value: String(item.value ?? ''),
        label: typeof item.label === 'string' ? item.label : String(item.value ?? ''),
        priceDelta: decimal((item.priceDelta ?? 0) as MoneyInput),
      }))
      .filter((option) => option.value.length > 0);
  }

  private parseValidation(raw: unknown): ParsedValidation {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
    const value = raw as Record<string, unknown>;
    return {
      min: finiteNumber(value.min),
      max: finiteNumber(value.max),
      minLength: finiteNumber(value.minLength),
      maxLength: finiteNumber(value.maxLength),
      pattern: typeof value.pattern === 'string' ? value.pattern : undefined,
      accept: Array.isArray(value.accept)
        ? value.accept.filter((item): item is string => typeof item === 'string')
        : undefined,
      maxBytes: finiteNumber(value.maxBytes),
    };
  }
}
