<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\BranchCustomer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
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
                        ->orWhere('senior_id_number', 'like', "%{$search}%")
                        ->orWhere('pwd_id_number', 'like', "%{$search}%");
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
            'senior_id_number' => ['nullable', 'string', 'max:50', 'required_if:customer_type,Senior Citizen'],
            'pwd_id_number' => ['nullable', 'string', 'max:50', 'required_if:customer_type,PWD'],
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
            'senior_id_number' => $validated['customer_type'] === 'Senior Citizen'
                ? ($validated['senior_id_number'] ?? null)
                : null,
            'pwd_id_number' => $validated['customer_type'] === 'PWD'
                ? ($validated['pwd_id_number'] ?? null)
                : null,
            'email' => $validated['email'] ?? null,
            'address' => $validated['address'] ?? null,
            'customer_type' => $validated['customer_type'],
            'status' => 'active',
            'created_by' => auth()->id(),
        ]);

        return redirect()->route('customer-management.index')
            ->with('success', 'Customer registered successfully.');
    }

    public function update(Request $request, int $id): RedirectResponse
    {
        $customer = BranchCustomer::findOrFail($id);
        $roleId = $this->roleId();
        $canAssignBranch = $roleId === 2;
        $branchId = $this->branchId();

        if (! $canAssignBranch && $customer->branch_id !== $branchId) {
            abort(403, 'You cannot edit customers outside your branch.');
        }

        $rules = [
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'senior_id_number' => ['nullable', 'string', 'max:50', 'required_if:customer_type,Senior Citizen'],
            'pwd_id_number' => ['nullable', 'string', 'max:50', 'required_if:customer_type,PWD'],
            'email' => ['nullable', 'email', 'max:100'],
            'address' => ['nullable', 'string'],
            'customer_type' => ['required', 'string', 'in:Regular,Senior Citizen,PWD'],
            'status' => ['required', 'string', 'in:active,inactive'],
        ];

        if ($canAssignBranch) {
            $rules['branch_id'] = ['required', 'integer', 'exists:branches,id'];
        }

        $validated = $request->validate($rules);

        $updateData = [
            'first_name' => $validated['first_name'],
            'last_name' => $validated['last_name'],
            'senior_id_number' => $validated['customer_type'] === 'Senior Citizen'
                ? ($validated['senior_id_number'] ?? null)
                : null,
            'pwd_id_number' => $validated['customer_type'] === 'PWD'
                ? ($validated['pwd_id_number'] ?? null)
                : null,
            'email' => $validated['email'] ?? null,
            'address' => $validated['address'] ?? null,
            'customer_type' => $validated['customer_type'],
            'status' => $validated['status'],
        ];

        if ($canAssignBranch) {
            $updateData['branch_id'] = (int) $validated['branch_id'];
        }

        $customer->update($updateData);

        return redirect()->route('customer-management.index')
            ->with('success', 'Customer updated successfully.');
    }

    /**
     * JSON list of active customers for a branch, used to populate the
     * customer select in the Return-from-customer modal.
     */
    public function forBranch(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'branch_id' => ['required', 'integer', 'exists:branches,id'],
        ]);

        $branchId = (int) $validated['branch_id'];
        $this->assertCanAccessBranch($branchId);

        $customers = BranchCustomer::query()
            ->where('branch_id', $branchId)
            ->where('status', 'active')
            ->orderBy('first_name')
            ->get(['customer_id', 'first_name', 'last_name', 'customer_type']);

        return response()->json(['customers' => $customers]);
    }

    /**
     * JSON create used by the inline "New Customer" modal inside the
     * Return-from-customer flow, so it doesn't disrupt the redirect-based
     * flow store() uses for the main Customer Management page.
     */
    public function quickStore(Request $request): JsonResponse
    {
        $roleId = $this->roleId();
        $canAssignBranch = $roleId === 2;

        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'senior_id_number' => ['nullable', 'string', 'max:50', 'required_if:customer_type,Senior Citizen'],
            'pwd_id_number' => ['nullable', 'string', 'max:50', 'required_if:customer_type,PWD'],
            'email' => ['nullable', 'email', 'max:100'],
            'address' => ['nullable', 'string'],
            'customer_type' => ['required', 'string', 'in:Regular,Senior Citizen,PWD'],
            'branch_id' => [$canAssignBranch ? 'required' : 'nullable', 'integer', 'exists:branches,id'],
        ]);

        $branchId = $canAssignBranch
            ? (int) $validated['branch_id']
            : $this->branchIdOrFail();

        $this->assertCanAccessBranch($branchId);

        $customer = BranchCustomer::create([
            'branch_id' => $branchId,
            'first_name' => $validated['first_name'],
            'last_name' => $validated['last_name'],
            'senior_id_number' => $validated['customer_type'] === 'Senior Citizen'
                ? ($validated['senior_id_number'] ?? null)
                : null,
            'pwd_id_number' => $validated['customer_type'] === 'PWD'
                ? ($validated['pwd_id_number'] ?? null)
                : null,
            'email' => $validated['email'] ?? null,
            'address' => $validated['address'] ?? null,
            'customer_type' => $validated['customer_type'],
            'status' => 'active',
            'created_by' => auth()->id(),
        ]);

        return response()->json(['customer' => $customer], 201);
    }

    private function assertCanAccessBranch(int $branchId): void
    {
        if ($this->roleId() === 2) {
            return;
        }

        $sessionBranchId = $this->branchId();

        if (! $sessionBranchId || $sessionBranchId !== $branchId) {
            abort(403, 'You do not have access to this branch.');
        }
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