<?php

namespace App\Http\Controllers;


use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;
use App\Models\Product;
use App\Models\Category;
use Illuminate\Support\Facades\Storage;
class ProductController extends Controller
{
    public function index(Request $request)
{

 $search = $request->input('search');
$category = $request->input('category');
 
 $products = Product::with('category') // Eager load category
          ->when($search, function ($query, $search) {
            $query->where(function ($query) use ($search) {
                $query->where('pd_name', 'like', "%{$search}%")
                      ->orWhere('pd_description', 'like', "%{$search}%")
                        ->orWhereHas('category', function ($query) use ($search){
                        $query->where('cat_name', 'like', "%{$search}%");
                      });   
            });
        })
        ->when($category && $category !== 'all', function ($query) use ($category) {
            $query->where('cat_id', $category);
        })
     
        
        ->orderBy('created_at', 'desc')
        ->get();

    $categories = Category::orderBy('cat_name', 'asc')
        ->get(['cat_id', 'cat_name']);

    return Inertia::render('Product/Index', [
        'products' => $products,
        'filters' => $request->only(['search', 'category']),
        'categories' => $categories, // Make sure this is included
    ]);
}

    public function create(): Response
    {
        return Inertia::render('Product/Create');
    }

    public function store(Request $request): RedirectResponse
    {
        $validatedData = $request->validate([
            'cat_id'         => ['required', 'integer', 'exists:tbl_category,cat_id'],
            'pd_name'        => ['required', 'string', 'max:244'],
            'pd_description' => ['nullable', 'string'],
            'pd_cost'        => ['required', 'numeric'],
            'pd_price'       => ['required', 'numeric'],
            'pd_qty' => ['nullable', 'integer', 'min:0'],
            'pd_mqty' => ['nullable', 'integer', 'min:0'],
           'pd_image' => ['nullable', 'image', 'mimes:jpeg,png,jpg,gif,webp', 'max:5120'], // 5 MB
        
        ]);

            //handle image upload
            if($request->hasFile('pd_image')){
                $imagePath = $request->file('pd_image')->store('products', 'public');
                $validatedData['pd_image'] = $imagePath;
            }
            
             
    // Set status based on quantity
    $qty = $validatedData['pd_qty'] ?? 0;
    $validatedData['pd_status'] = $qty > 0 ? 'Available' : 'Not Available';

        Product::create($validatedData);
        return redirect('/product')->with('success', 'Product created successfully!');
    }

    public function edit($pd_id): Response
    {
        $products = Product::findOrFail($pd_id);

        return Inertia::render('Product/Edit', [
            'Product' => $products,
        ]);
    }

    public function update(Request $request, $pd_id): RedirectResponse
    {
        $validatedData = $request->validate([
            'cat_id'         => ['required', 'integer', 'exists:tbl_category,cat_id'],
            'pd_name'        => ['required', 'string', 'max:244'],
            'pd_description' => ['nullable', 'string'],
            'pd_cost'        => ['required', 'numeric'],
            'pd_price'       => ['required', 'numeric'],
            'pd_qty'         => ['nullable', 'integer', 'min:0'],
            'pd_mqty'        => ['required', 'integer', 'min:0'],
            'pd_image' => ['nullable', 'image', 'mimes:jpeg,png,jpg,gif,webp', 'max:5120'], // 5 MB
   
        ]);
        
        $product = Product::findOrFail($pd_id);
        
        // Handle image upload
        if ($request->hasFile('pd_image')) {
            // Delete old image if exists
            if ($product->pd_image && Storage::disk('public')->exists($product->pd_image)) {
                Storage::disk('public')->delete($product->pd_image);
            }
            
            // Store new image
            $imagePath = $request->file('pd_image')->store('products', 'public');
            $validatedData['pd_image'] = $imagePath;
        } else {
            // If no new image, we want to KEEP the existing value
            // If the product has no image (null), it stays null
            // If the product has an image, it stays the same
            unset($validatedData['pd_image']);
        }
            // Simple status based on quantity
        $qty = $validatedData['pd_qty'] ?? $product->pd_qty;
        $validatedData['pd_status'] = $qty > 0 ? 'Available' : 'Not Available';

        $product->update($validatedData);
        return redirect('/product')->with('success', 'Product updated successfully!');
    }

    public function destroy($pd_id): RedirectResponse
    {
        $product = Product::findOrFail($pd_id);
        $product->delete();
        return redirect('/product')->with('success', 'Delete');

    }
}
