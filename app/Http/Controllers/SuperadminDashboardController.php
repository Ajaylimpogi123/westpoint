<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class SuperadminDashboardController extends Controller
{
    public function index(Request $request): Response
    {
        $users = User::with(['role:id,role_name', 'branch:id,branch_name'])
            ->when($request->filled('role_id'), fn ($query) => $query->where('role_id', $request->role_id))
            ->when($request->filled('branch_id'), fn ($query) => $query->where('branch_id', $request->branch_id))
            ->orderByDesc('created_at')
            ->paginate(10)
            ->withQueryString();

        return Inertia::render('SuperadminDashboard', [
            'branches' => Branch::orderBy('branch_name')->get(['id', 'branch_name']),
            'roles' => Role::orderBy('role_name')->get(['id', 'role_name']),
            'users' => $users,
            'filters' => $request->only(['role_id', 'branch_id']),
        ]);
    }
}
