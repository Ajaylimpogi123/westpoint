<?php

namespace Tests\Feature;

use App\Enums\PaymentMethod;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Services\ReceiptPrinterService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\SeedsWestpoint;
use Tests\TestCase;

class ReceiptPaymentLabelTest extends TestCase
{
    use RefreshDatabase;
    use SeedsWestpoint;

    private string $receiptFile;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedWestpoint();

        // A "COM" printer pointed at a temp file: FilePrintConnector writes the
        // raw ESC/POS bytes there, so the printed text can be asserted on.
        $this->receiptFile = tempnam(sys_get_temp_dir(), 'receipt');
        config([
            'printer.default' => 'test',
            'printer.branch_printers' => [],
            'printer.printers.test' => [
                'enabled' => true,
                'method' => 'com',
                'com_port' => $this->receiptFile,
            ],
        ]);
    }

    protected function tearDown(): void
    {
        @unlink($this->receiptFile);
        parent::tearDown();
    }

    public static function storedValueProvider(): array
    {
        return [
            'cash' => ['cash', 'Cash'],
            'gcash' => ['gcash', 'GCash'],
            'debit card' => ['debit_card', 'Debit Card'],
            'credit card' => ['credit_card', 'Credit Card'],
            'PH GAMOT' => ['PH_GAMOT', 'PH GAMOT'],
            'bank transfer' => ['bank_transfer', 'Bank Transfer'],
            'others' => ['others', 'Others'],
            'stock-out delivery' => ['Delivery to Customer', 'Delivery to Customer'],
            'legacy dispense' => ['Dispensed to patient', 'Delivery to Customer'],
            'unknown legacy value' => ['online_wallet', 'Online Wallet'],
        ];
    }

    #[DataProvider('storedValueProvider')]
    public function test_printed_receipt_uses_pos_payment_labels(string $stored, string $expectedLabel): void
    {
        $sale = Sale::forceCreate([
            'invoice_number' => 'INV-RECEIPT-1',
            'branch_id' => $this->branchA->id,
            'user_id' => $this->staff->id,
            'gross_amount' => 45,
            'discount_amount' => 0,
            'net_amount' => 45,
            'payment_method' => $stored,
        ]);

        SaleItem::create([
            'sale_id' => $sale->id,
            'product_id' => $this->product->id,
            'unit_type' => 'Box',
            'quantity_sold' => 1,
            'price_used' => 45,
            'total_price' => 45,
        ]);

        $this->assertTrue(app(ReceiptPrinterService::class)->printReceipt($sale));

        $printed = file_get_contents($this->receiptFile);
        $this->assertStringContainsString("Payment: {$expectedLabel}\n", $printed);
        $this->assertSame($expectedLabel, PaymentMethod::labelFor($stored));
    }

    public function test_label_for_handles_blank_values(): void
    {
        $this->assertSame('', PaymentMethod::labelFor(null));
        $this->assertSame('', PaymentMethod::labelFor('  '));
        $this->assertSame('PH GAMOT', PaymentMethod::labelFor(' PH_GAMOT '));
    }
}
