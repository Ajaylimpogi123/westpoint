<?php

namespace App\Enums;

/**
 * Every payment method a tbl_sales row can carry.
 *
 * Backed values are exactly what is stored in tbl_sales.payment_method
 * (mixed casing is historical — PH_GAMOT — and must not be normalised).
 *
 * The POS cases are what PosController@store accepts and what the checkout
 * dialog offers. DeliveryToCustomer is not a POS method: it is written by
 * StockOutController when a "Delivery to Customer" stock-out is turned into a
 * sale, and older rows from that flow were stored as "Dispensed to patient".
 */
enum PaymentMethod: string
{
    case Cash = 'cash';
    case GCash = 'gcash';
    case DebitCard = 'debit_card';
    case CreditCard = 'credit_card';
    case PhGamot = 'PH_GAMOT';
    case BankTransfer = 'bank_transfer';
    case Others = 'others';
    case DeliveryToCustomer = 'Delivery to Customer';

    /** Stored value written by an older version of the stock-out flow. */
    public const LEGACY_DISPENSED_TO_PATIENT = 'Dispensed to patient';

    /**
     * Methods a cashier may choose at POS checkout, in checkout-dialog order.
     *
     * @return list<self>
     */
    public static function posCases(): array
    {
        return array_values(array_filter(
            self::cases(),
            fn (self $method) => $method->isPos()
        ));
    }

    /**
     * @return list<string>
     */
    public static function posValues(): array
    {
        return array_map(fn (self $method) => $method->value, self::posCases());
    }

    public function isPos(): bool
    {
        return $this !== self::DeliveryToCustomer;
    }

    public function label(): string
    {
        return match ($this) {
            self::Cash => 'Cash',
            self::GCash => 'GCash',
            self::DebitCard => 'Debit Card',
            self::CreditCard => 'Credit Card',
            self::PhGamot => 'PH GAMOT',
            self::BankTransfer => 'Bank Transfer',
            self::Others => 'Others',
            self::DeliveryToCustomer => 'Delivery to Customer',
        };
    }

    /**
     * Display label for any stored tbl_sales.payment_method value, including
     * legacy and unknown ones (receipts, history, exports).
     */
    public static function labelFor(?string $stored): string
    {
        $stored = trim((string) $stored);

        if ($stored === '') {
            return '';
        }

        if ($stored === self::LEGACY_DISPENSED_TO_PATIENT) {
            return self::DeliveryToCustomer->label();
        }

        return self::tryFrom($stored)?->label()
            ?? ucwords(str_replace('_', ' ', $stored));
    }

    /**
     * Value used in dashboard/report filter query strings. Matches the stored
     * value for POS methods; the stock-out source gets a URL-friendly slug.
     */
    public function filterValue(): string
    {
        return $this === self::DeliveryToCustomer ? 'delivery_to_customer' : $this->value;
    }

    public static function fromFilterValue(?string $value): ?self
    {
        if ($value === null) {
            return null;
        }

        foreach (self::cases() as $method) {
            if ($method->filterValue() === $value) {
                return $method;
            }
        }

        return null;
    }

    /**
     * Every tbl_sales.payment_method value that belongs to this method.
     *
     * @return list<string>
     */
    public function storedValues(): array
    {
        return $this === self::DeliveryToCustomer
            ? [$this->value, self::LEGACY_DISPENSED_TO_PATIENT]
            : [$this->value];
    }

    /**
     * Dropdown options for filter UIs.
     *
     * @return list<array{value: string, label: string}>
     */
    public static function filterOptions(): array
    {
        return array_map(
            fn (self $method) => ['value' => $method->filterValue(), 'label' => $method->label()],
            self::cases()
        );
    }
}
