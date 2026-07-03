<?php

namespace App\Http\Controllers;

use App\Models\InventoryMovementLog;
use Illuminate\Http\JsonResponse;

class MovementLogController extends Controller
{
    public function show(InventoryMovementLog $movementLog): JsonResponse
    {
        $branchId = $this->branchIdOrFail();

        if ((int) $movementLog->branch_id !== $branchId) {
            abort(403, 'You do not have access to this movement log.');
        }

        $movementLog->load([
            'performer:id,name,email',
            'product:id,med_name,brand_name,dose,form,status,retail_price,wholesale_price,pack_size',
        ]);

        return response()->json([
            'log' => [
                'log_id' => $movementLog->log_id,
                'movement_type' => $movementLog->movement_type,
                'reference_label' => $movementLog->reference_label,
                'reference_id' => $movementLog->reference_id,
                'medicine_name' => $movementLog->medicine_name,
                'lot_number' => $movementLog->lot_number,
                'quantity' => $movementLog->quantity,
                'remarks' => $movementLog->remarks,
                'metadata' => $movementLog->metadata,
                'created_at' => $movementLog->created_at,
                'performer' => $movementLog->performer ? [
                    'name' => $movementLog->performer->name,
                    'email' => $movementLog->performer->email,
                ] : null,
                'product' => $movementLog->product ? [
                    'med_name' => $movementLog->product->med_name,
                    'brand_name' => $movementLog->product->brand_name,
                    'dose' => $movementLog->product->dose,
                    'form' => $movementLog->product->form,
                    'status' => $movementLog->product->status,
                    'retail_price' => $movementLog->product->retail_price,
                    'wholesale_price' => $movementLog->product->wholesale_price,
                    'pack_size' => $movementLog->product->pack_size,
                ] : null,
            ],
        ]);
    }

    private function branchIdOrFail(): int
    {
        $branchId = session('branch_id');

        if (! $branchId) {
            abort(403, 'No branch assigned to your session.');
        }

        return (int) $branchId;
    }
}
