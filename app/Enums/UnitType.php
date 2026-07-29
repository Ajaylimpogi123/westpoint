<?php

namespace App\Enums;

use ValueError;

/**
 * The two units a medicine can be transacted in.
 *
 * Inventory is always stored in pieces (products_qty.quantity); Box is a
 * presentation unit that must be multiplied by the product's pack_size
 * before it touches stock. See MedicineProduct::toPieces().
 *
 * Historical rows are inconsistently cased — tbl_stock_out_items stored
 * 'piece'/'box' while every other table stored 'Piece'/'Box' — so parsing
 * is case-insensitive while output is always canonical.
 */
enum UnitType: string
{
    case Piece = 'Piece';
    case Box = 'Box';

    public static function fromInput(?string $value): self
    {
        $candidate = strtolower(trim((string) $value));

        return match ($candidate) {
            'piece' => self::Piece,
            'box' => self::Box,
            default => throw new ValueError("Unsupported unit type [{$value}]."),
        };
    }

    public static function tryFromInput(?string $value): ?self
    {
        try {
            return self::fromInput($value);
        } catch (ValueError) {
            return null;
        }
    }

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    public function isBox(): bool
    {
        return $this === self::Box;
    }

    public function label(): string
    {
        return match ($this) {
            self::Piece => 'Piece',
            self::Box => 'Box / Wholesale',
        };
    }
}
