<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    private const SUPERADMIN_ROLE_ID = 3;

    public function index(Request $request): Response
    {
        $users = User::with(['role:id,role_name', 'branch:id,branch_name'])
            ->when($request->filled('role_id'), fn ($query) => $query->where('role_id', $request->role_id))
            ->when($request->filled('branch_id'), fn ($query) => $query->where('branch_id', $request->branch_id))
            ->when(
                $request->filled('status') && in_array($request->status, ['active', 'inactive'], true),
                fn ($query) => $query->where('status', $request->status),
            )
            ->orderByDesc('created_at')
            ->paginate(10)
            ->withQueryString();

        return Inertia::render('UserManagement/Index', [
            'branches' => Branch::orderBy('branch_name')->get(['id', 'branch_name']),
            'roles' => Role::orderBy('role_name')->get(['id', 'role_name']),
            'users' => $users,
            'filters' => $request->only(['role_id', 'branch_id', 'status']),
        ]);
    }

    public function update(Request $request, int $id): RedirectResponse
    {
        $user = User::findOrFail($id);
        $actor = $request->user();

        $this->authorizeUserManagement($actor, $user);

        $rules = [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:users,email,'.$user->id],
            'branch_id' => ['required', 'exists:branches,id'],
            'role_id' => ['required', 'exists:roles,id'],
        ];

        if ($request->filled('password')) {
            $rules['password'] = ['required', 'confirmed', Rules\Password::defaults()];
        }

        $validated = $request->validate($rules);

        if ($actor->role_id === 2 && (int) $validated['role_id'] === self::SUPERADMIN_ROLE_ID) {
            return redirect()->route('user-management.index')
                ->with('error', 'You cannot assign the superadmin role.');
        }

        $updateData = [
            'name' => $validated['name'],
            'email' => $validated['email'],
            'branch_id' => $validated['branch_id'],
            'role_id' => $validated['role_id'],
        ];

        if (! empty($validated['password'])) {
            $updateData['password'] = Hash::make($validated['password']);
        }

        $user->update($updateData);

        return redirect()->route('user-management.index')
            ->with('success', 'User updated successfully.');
    }

    public function toggleStatus(Request $request, int $id): RedirectResponse
    {
        $user = User::findOrFail($id);
        $actor = $request->user();

        $this->authorizeUserManagement($actor, $user, allowSelf: false);

        $newStatus = $user->status === 'active' ? 'inactive' : 'active';
        $user->update(['status' => $newStatus]);

        $message = $newStatus === 'inactive'
            ? 'User account deactivated successfully.'
            : 'User account activated successfully.';

        return redirect()->route('user-management.index')
            ->with('success', $message);
    }

    private function authorizeUserManagement(User $actor, User $target, bool $allowSelf = true): void
    {
        if (! $allowSelf && $actor->id === $target->id) {
            abort(403, 'You cannot change your own account status.');
        }

        if ($actor->role_id === 2 && $target->role_id === self::SUPERADMIN_ROLE_ID) {
            abort(403, 'You cannot manage superadmin accounts.');
        }
    }
}
