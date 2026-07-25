<?php

namespace App\Services;

use App\Models\Sale;
use Mike42\Escpos\Printer;
use Mike42\Escpos\PrintConnectors\FilePrintConnector;
use Mike42\Escpos\PrintConnectors\NetworkPrintConnector;
use Illuminate\Support\Facades\Log;

class ReceiptPrinterService
{
    /**
     * Print a receipt for the given sale. Picks the printer for the
     * sale's branch automatically (via config('printer.branch_printers')),
     * unless a printer name is explicitly passed. Never throws — logs a
     * warning and returns false if the printer isn't reachable, so a
     * missing/offline printer never blocks checkout.
     */
    public function printReceipt(Sale $sale, ?string $printerName = null): bool
    {
        $printerName ??= config("printer.branch_printers.{$sale->branch_id}")
            ?? config('printer.default');

        $profile = config("printer.printers.{$printerName}");

        if (!$profile || !($profile['enabled'] ?? false)) {
            return false;
        }

        $connector = $this->resolveConnector($profile);

        if (!$connector) {
            Log::warning("Printer '{$printerName}' not reachable, skipping auto-print.", [
                'sale_id' => $sale->id,
                'invoice_number' => $sale->invoice_number,
            ]);
            return false;
        }

        try {
            $printer = new Printer($connector);
            $this->buildReceipt($printer, $sale);
            $printer->close();
            return true;
        } catch (\Exception $e) {
            Log::error("Receipt print failed: " . $e->getMessage(), [
                'sale_id' => $sale->id,
            ]);
            return false;
        }
    }

    public function isPrinterConnected(?string $printerName = null): bool
    {
        $printerName ??= config('printer.default');
        $profile = config("printer.printers.{$printerName}");

        return $profile && $this->resolveConnector($profile) !== null;
    }

    private function resolveConnector(array $profile)
    {
        return match ($profile['method']) {
            'com' => $this->resolveComConnector($profile),
            'network' => $this->resolveNetworkConnector($profile),
            default => null,
        };
    }

    private function resolveComConnector(array $profile): ?FilePrintConnector
    {
        $port = $profile['com_port'];
        $baud = $profile['com_baud'] ?? 9600;

        @exec("mode {$port}: baud={$baud} parity=N data=8 stop=1");

        try {
            return new FilePrintConnector($port);
        } catch (\Exception $e) {
            return null;
        }
    }

    private function resolveNetworkConnector(array $profile): ?NetworkPrintConnector
    {
        $ip = $profile['network_ip'];
        $port = $profile['network_port'];
        $timeout = config('printer.connect_timeout', 2);

        $socket = @fsockopen($ip, $port, $errno, $errstr, $timeout);

        if (!$socket) {
            return null;
        }

        fclose($socket);

        try {
            return new NetworkPrintConnector($ip, $port);
        } catch (\Exception $e) {
            return null;
        }
    }

    private function buildReceipt(Printer $printer, Sale $sale): void
    {
        // Make sure items + products are loaded before printing
        $sale->loadMissing('items.product');

        $printer->setJustification(Printer::JUSTIFY_CENTER);
        $printer->setEmphasis(true);
        $printer->text(config('printer.store_name') . "\n");
        $printer->setEmphasis(false);
        $printer->text("Invoice: {$sale->invoice_number}\n");
        $printer->text($sale->created_at->format('Y-m-d H:i') . "\n");

        if ($sale->customer_name) {
            $printer->text("Customer: {$sale->customer_name}\n");
        }

        $printer->text(str_repeat('-', 32) . "\n");
        $printer->setJustification(Printer::JUSTIFY_LEFT);

        foreach ($sale->items as $item) {
            $name = $item->product->med_name ?? 'Item';
            $qty = $item->quantity_sold;
            $unit = $item->unit_type;
            $price = number_format($item->price_used, 2);
            $lineTotal = number_format($item->total_price, 2);

            $printer->text(sprintf("%-20s\n", $name));
            $printer->text(sprintf("  %d %s x %s", $qty, $unit, $price));
            $printer->setJustification(Printer::JUSTIFY_RIGHT);
            $printer->text("P{$lineTotal}\n");
            $printer->setJustification(Printer::JUSTIFY_LEFT);
        }

        $printer->text(str_repeat('-', 32) . "\n");
        $printer->setJustification(Printer::JUSTIFY_RIGHT);

        $printer->text("Gross: P" . number_format($sale->gross_amount, 2) . "\n");

        if ($sale->discount_amount > 0) {
            $printer->text("Discount: -P" . number_format($sale->discount_amount, 2) . "\n");
        }

        $printer->setEmphasis(true);
        $printer->text("TOTAL: P" . number_format($sale->net_amount, 2) . "\n");
        $printer->setEmphasis(false);

        $printer->text("Payment: " . ucfirst($sale->payment_method) . "\n");

        if ($sale->reference_number) {
            $printer->text("Ref #: {$sale->reference_number}\n");
        }

        $printer->feed(2);
        $printer->setJustification(Printer::JUSTIFY_CENTER);
        $printer->text("Thank you!\n");
        $printer->feed(3);
        $printer->cut();
    }
}