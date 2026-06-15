<?php

namespace App\Http\Controllers;


use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;
use App\Models\Category;
use Illuminate\Support\Facades\Storage;
class CategoryController extends Controller
{
    public function index(Request $request)
{
    $search = $request->input('search');

    $categories = Category::query()
        ->when($search, function ($query, $search) {
            $query->where(function ($query) use ($search) {
                $query->where('cat_name', 'like', "%{$search}%")
                      ->orWhere('cat_description', 'like', "%{$search}%")
                      ->orWhere('pd_keyword', 'like', "%{$search}%");        
            });
        })
        ->orderBy('cat_id', 'asc')
         ->get();

    return Inertia::render('Category/Index', [
        'categories' => $categories,
        'filters' => $request->only(['search']),
    ]);
}



    public function store(Request $request): RedirectResponse
    {
        $validatedData = $request->validate([
            'cat_name' => ['required', 'string', 'max:255'],
            'cat_description' => ['nullable', 'string', 'max:255'],
            'cat_image' => ['nullable', 'image', 'mimes:jpeg,png,jpg,gif,webp', 'max:2048'],
        ]);

            //handle image upload
            if($request->hasFile('cat_image')){
                $imagePath = $request->file('cat_image')->store('categories', 'public');
                $validatedData['cat_image'] = $imagePath;
            }
            
    
        Category::create($validatedData);
        return redirect('/category')->with('success', 'Category created successfully!');
    }



    public function update(Request $request, $cat_id): RedirectResponse
    {
        $validatedData = $request->validate([
            'cat_name' => ['required', 'string', 'max:255'],
            'cat_description' => ['nullable', 'string', 'max:255'],
             'cat_image' => ['nullable', 'image', 'mimes:jpeg,png,jpg,gif,webp', 'max:2048'],        
        ]);
        
   
        $category = Category::findOrFail($cat_id);
      // Handle image upload
    if ($request->hasFile('cat_image')) {
        // Delete old image if exists
        if ($category->cat_image && Storage::disk('public')->exists($category->cat_image)) {
            Storage::disk('public')->delete($category->cat_image);
        }
        
        // Store new image
        $imagePath = $request->file('cat_image')->store('categories', 'public');
        $validatedData['cat_image'] = $imagePath;
    } else {
        // Keep existing image
        unset($validatedData['cat_image']);
    }

            $category->update($validatedData);
            return redirect('/category')->with('success', 'Category created successfully!');
    }

    public function destroy($cat_id): RedirectResponse
    {
        $category = Category::findOrFail($cat_id);
        $category->delete();
        return redirect('/category')->with('success', 'Delete');

    }
}
