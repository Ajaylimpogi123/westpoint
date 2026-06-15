<?php

namespace App\Http\Controllers;


use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;
use App\Models\Table;
use App\Models\Cart; 
use App\Models\Category;
use App\Models\Product;

use Illuminate\Support\Facades\Storage;
class MenuController extends Controller
{
  
    public function index()
    {
        // Get tables with count of cart items
        $occupied_tables = Cart::select('table_id')
            ->selectRaw('count(*) as item_count')
            ->groupBy('table_id')
            ->get()
            ->map(function($item) {
                return [
                    'table_id' => $item->table_id,
                    'item_count' => $item->item_count
                ];
            })
            ->toArray();
        
        // Create a lookup array for quick access
        $table_item_counts = [];
        foreach ($occupied_tables as $table) {
            $table_item_counts[$table['table_id']] = $table['item_count'];
        }
        
        $tables = Table::orderBy('t_number', 'asc')
            ->get()
            ->toArray();
        
        return Inertia::render('Menu/Index', [
            'tables' => $tables,
            'table_ids' => array_keys($table_item_counts), // Just the IDs
            'table_item_counts' => $table_item_counts, // IDs with counts
        ]);
    }


    public function menu(Request $request, $table_id): Response
    {
        $tables = Table::findOrFail($table_id);
    
        $categories = Category::with('products')
            ->orderBy('cat_id', 'asc')
            ->get();
    
        $search = $request->input('search');
    
        $products = Product::select('pd_id', 'cat_id', 'pd_name', 'pd_description', 'pd_price', 'pd_image', 'pd_qty', 'pd_mqty', 'pd_status')
            ->when($search, fn($query) => 
                $query->where(fn($q) => 
                    $q->where('pd_name', 'like', "%{$search}%")
                      ->orWhere('pd_description', 'like', "%{$search}%")
                )
            )
            ->orderBy('pd_name', 'asc')
            ->get();
    
        $cartItems = Cart::where('table_id', $table_id)
            ->with('product:pd_id,pd_name,pd_price,pd_image')
            ->get()
            ->map(fn($cart) => [
                'pd_id' => $cart->pd_id,
                'cat_id' => $cart->cat_id,
                'ct_id' => $cart->ct_id,
                'pd_name' => $cart->product?->pd_name,
                'pd_price' => $cart->product?->pd_price ?? 0,
                'ct_qty' => $cart->ct_qty,
                'pd_image' => $cart->product?->pd_image,
            ]);
    
        return Inertia::render('Menu/Menu', [
            'tables' => $tables,
            'table_id' => $table_id,
            'categories' => $categories,
            'products' => $products,
            'cartItems' => $cartItems,
            'cartItemsCount' => $cartItems->count(),
            'filters' => $request->only(["search"]),
            'flash' => [
            'success' => session('success'),
            'order' => session('order'),
            'error' => session('error')
        ], // ADD THIS
        ]);
    }

    public function store($table_id, Request $request): RedirectResponse
    {
        $validatedData = $request->validate([
            'pd_id'    => 'required|integer',
            'table_id' => 'required|integer',
            'table_number' => 'required|integer',
            'ct_qty'   => 'required|numeric|min:1',
            'ct_price' => 'required|numeric',
        ]);
    
       
            $cart = Cart::where('pd_id', $validatedData['pd_id'])
                        ->where('table_id', $validatedData['table_id'])
                        ->first();
    
            if ($cart) {
                $cart->increment('ct_qty', $validatedData['ct_qty']);
            } else {
                Cart::create($validatedData);
            }
    
            return redirect()->route('menu.menu', ['table_id' => $table_id]) // ✅ redirect to same page
                             ->with('success', 'Item added to cart.');
    
      
    }

public function destroy($table_id, $cart)
{
    // Find the cart item
    $cart = Cart::where('table_id', $table_id)
                ->where('ct_id', $cart)
                ->first();
    
    if (!$cart) {
        return redirect()->back()->with('error', 'Cart item not found');
    }
    
    $cart->delete();
    
    return redirect()->back()->with('success', 'Item removed from cart successfully');
}


public function update(Request $request, Table $table_id, Cart $cart)
{
    try {

        // Validate request
        $validated = $request->validate([
            'ct_qty' => 'required|integer|min:1|max:99'
        ]);

        // Check if cart belongs to table
        if ($cart->table_id !== $table_id->table_id) {
            return redirect()->back()->with('error', 'Cart item does not belong to this table');
        }

        // Update quantity
        $cart->update([
            'ct_qty' => $validated['ct_qty']
        ]);

        // Success response for Inertia
        return redirect()->back()->with('success', 'Cart updated successfully');

        } catch (\Illuminate\Validation\ValidationException $e) {

            return redirect()->back()->withErrors($e->errors());

        } catch (\Exception $e) {

            Log::error('Error updating cart: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());

            return redirect()->back()->with('error', 'Failed to update cart');
        }
}
}
