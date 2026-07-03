<?php

namespace App\Services;

use App\Models\InventoryMovementLog;

class InventoryMovementLogger
{
    public const FIELD_LABELS = [
        'med_name' => 'Medicine Name',
        'dose' => 'Dose',
        'form' => 'Form',
        'pack_size' => 'Pack Size',
        'brand_name' => 'Brand',
        'retail_price' => 'Retail Price',
        'wholesale_price' => 'Wholesale Price',
        'lot_number' => 'Lot Number',
        'expiry' => 'Expiry Date',
        'quantity' => 'Quantity',
        'boxes_received' => 'Boxes',
    ];

    public static function log(
        int $branchId,
        string $movementType,
        string $referenceLabel,
        ?int $referenceId,
        ?int $pdId,
        string $medicineName,
        ?string $lotNumber = null,
        ?int $quantity = null,
        ?string $remarks = null,
        ?int $performedBy = null,
        ?array $metadata = null,
    ): InventoryMovementLog {
        return InventoryMovementLog::create([
            'branch_id' => $branchId,
            'movement_type' => $movementType,
            'reference_label' => $referenceLabel,
            'reference_id' => $referenceId,
            'pd_id' => $pdId,
            'medicine_name' => $medicineName,
            'lot_number' => $lotNumber,
            'quantity' => $quantity,
            'performed_by' => $performedBy ?? (int) auth()->id(),
            'remarks' => $remarks,
            'metadata' => $metadata,
        ]);
    }

    /**
     * @param  array<string, mixed>  $before
     * @param  array<string, mixed>  $after
     * @return list<array{field: string, label: string, old: mixed, new: mixed}>
     */
    public static function diffFields(array $before, array $after, array $fields): array
    {
        $changes = [];

        foreach ($fields as $field) {
            $old = $before[$field] ?? null;
            $new = $after[$field] ?? null;

            if (self::valuesEqual($old, $new)) {
                continue;
            }

            $changes[] = [
                'field' => $field,
                'label' => self::FIELD_LABELS[$field] ?? ucfirst(str_replace('_', ' ', $field)),
                'old' => self::formatValue($field, $old),
                'new' => self::formatValue($field, $new),
            ];
        }

        return $changes;
    }

    /**
     * @param  array<string, mixed>  $values
     * @return list<array{field: string, label: string, value: mixed}>
     */
    public static function snapshotFields(array $values, array $fields): array
    {
        $snapshot = [];

        foreach ($fields as $field) {
            if (! array_key_exists($field, $values)) {
                continue;
            }

            $snapshot[] = [
                'field' => $field,
                'label' => self::FIELD_LABELS[$field] ?? ucfirst(str_replace('_', ' ', $field)),
                'value' => self::formatValue($field, $values[$field]),
            ];
        }

        return $snapshot;
    }

    private static function valuesEqual(mixed $old, mixed $new): bool
    {
        if (is_numeric($old) && is_numeric($new)) {
            return round((float) $old, 2) === round((float) $new, 2);
        }

        return (string) ($old ?? '') === (string) ($new ?? '');
    }

    private static function formatValue(string $field, mixed $value): mixed
    {
        if ($value === null || $value === '') {
            return '—';
        }

        if (in_array($field, ['retail_price', 'wholesale_price'], true)) {
            return number_format((float) $value, 2, '.', '');
        }

        if ($field === 'expiry' && $value) {
            return (string) $value;
        }

        return $value;
    }
}
