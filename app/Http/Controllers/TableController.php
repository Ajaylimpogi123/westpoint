<?php

namespace App\Http\Controllers;


use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;
use App\Models\Table;
use Illuminate\Support\Facades\Storage;
class TableController extends Controller
{
    public function index(Request $request)
{
    $search = $request->input('search');

    $tables = Table::query()
        ->when($search, function ($query, $search) {
            $query->where(function ($query) use ($search) {
                $query->where('t_number', 'like', "%{$search}%")
                      ->orWhere('t_description', 'like', "%{$search}%");        
            });
        })
        ->orderBy('t_number', 'asc')
         ->get(); 

    return Inertia::render('Table/Index', [
        'tables' => $tables,
        'filters' => $request->only(['search']),
    ]);
}



    public function store(Request $request): RedirectResponse
    {
        $validatedData = $request->validate([
            't_number' => ['required', 'integer', 'max:100'],
            't_description' => ['nullable', 'string', 'max:255'],
        ]);
    
        Table::create($validatedData);
        return redirect('/table')->with('success', 'Table created successfully!');
    }



    public function update(Request $request, $table_id): RedirectResponse
    {
        $validatedData = $request->validate([
            't_number' => ['required', 'integer', 'max:100'],
            't_description' => ['nullable', 'string', 'max:255'],
  
        ]);
        
        $table = Table::findOrFail($table_id);

            $table->update($validatedData);
            return redirect('/table')->with('success', 'Table updated successfully!');
    }

    public function destroy($table_id): RedirectResponse
    {
        $table = Table::findOrFail($table_id);
        $table->delete();
        return redirect('/table')->with('success', 'Delete');

    }
}
