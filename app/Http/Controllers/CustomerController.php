<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\BranchCustomer;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CustomerController extends Controller
{
    public function index(Request $request): Response
    {
        $roleId = $this->roleId();
        $branchId = $this->branchId();
        $search = $request->input('search');
        $canFilterBranches = $roleId === 2;
        $branchName = $branchId
            ? Branch::query()->whereKey($branchId)->value('branch_name')
            : null;

        $customers = BranchCustomer::query()
            ->with('branch:id,branch_name')
            ->when(! $canFilterBranches, fn ($query) => $query->forBranch($branchId))
            ->when(
                $canFilterBranches && $request->filled('branch_id'),
                fn ($query) => $query->where('branch_id', $request->input('branch_id'))
            )
            ->when($search, function ($query, $search) {
                $query->where(function ($query) use ($search) {
                    $query->where('first_name', 'like', "%{$search}%")
                        ->orWhere('last_name', 'like', "%{$search}%")
                        ->orWhere('phone_number', 'like', "%{$search}%");
                });
            })
            ->orderByDesc('created_at')
            ->paginate(50)
            ->withQueryString();

        return Inertia::render('CustomerManagement/Index', [
            'customers' => $customers,
            'branches' => $canFilterBranches
                ? Branch::orderBy('branch_name')->get(['id', 'branch_name'])
                : [],
            'filters' => $request->only(['search', 'branch_id']),
            'canFilterBranches' => $canFilterBranches,
            'branchId' => $branchId,
            'branchName' => $branchName,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $roleId = $this->roleId();
        $canAssignBranch = $roleId === 2;

        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'phone_number' => ['nullable', 'digits:11'],
            'email' => ['nullable', 'email', 'max:100'],
            'address' => ['nullable', 'string'],
            'customer_type' => ['required', 'string', 'in:Regular,Senior Citizen,PWD'],
            'branch_id' => [$canAssignBranch ? 'required' : 'nullable', 'integer', 'exists:branches,id'],
        ]);

        $branchId = $canAssignBranch
            ? (int) $validated['branch_id']
            : $this->branchIdOrFail();

        BranchCustomer::create([
            'branch_id' => $branchId,
            'first_name' => $validated['first_name'],
            'last_name' => $validated['last_name'],
            'phone_number' => $validated['phone_number'] ?? null,
            'email' => $validated['email'] ?? null,
            'address' => $validated['address'] ?? null,
            'customer_type' => $validated['customer_type'],
            'status' => 'active',
            'created_by' => auth()->id(),
        ]);

        return redirect()->route('customer-management.index')
            ->with('success', 'Customer registered successfully.');
    }

    private function roleId(): int
    {
        return (int) session('role_id');
    }

    private function branchId(): ?int
    {
        $branchId = session('branch_id');

        return $branchId ? (int) $branchId : null;
    }

    private function branchIdOrFail(): int
    {
        $branchId = $this->branchId();

        if (! $branchId) {
            abort(403, 'No branch assigned to your session.');
        }

        return $branchId;
    }
}
