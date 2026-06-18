<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class BranchController extends Controller
{
    public function index(Request $request): Response
    {
        $branches = Branch::query()
            ->orderBy('branch_name')
            ->paginate(10)
            ->withQueryString();

        return Inertia::render('BranchManagement/Index', [
            'branches' => $branches,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'branch_name' => ['required', 'string', 'max:100', 'unique:branches,branch_name'],
        ]);

        Branch::create($validated);

        return redirect()->route('branch-management.index')
            ->with('success', 'Branch created successfully.');
    }

    public function update(Request $request, int $id): RedirectResponse
    {
        $branch = Branch::findOrFail($id);

        $validated = $request->validate([
            'branch_name' => [
                'required',
                'string',
                'max:100',
                'unique:branches,branch_name,' . $branch->id,
            ],
        ]);

        $branch->update($validated);

        return redirect()->route('branch-management.index')
            ->with('success', 'Branch updated successfully.');
    }

    public function destroy(int $id): RedirectResponse
    {
        $branch = Branch::findOrFail($id);
        $branch->delete();

        return redirect()->route('branch-management.index')
            ->with('success', 'Branch deleted successfully.');
    }
}
