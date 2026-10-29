<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Role;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules;
use Inertia\Inertia;
use Inertia\Response;

class RegisteredUserController extends Controller
{
    private const SUPERADMIN_ROLE_ID = 3;

    /**
     * Display the registration view.
     */
    public function create(): Response
    {
        $branches = Branch::all(['id', 'branch_name']);
        // Only a superadmin may create another superadmin.
        $roles = Role::query()
            ->when((int) auth()->user()?->role_id !== self::SUPERADMIN_ROLE_ID, fn ($query) => $query->where('id', '!=', self::SUPERADMIN_ROLE_ID))
            ->get(['id', 'role_name']);

        return Inertia::render('Auth/Register', [
            'branches' => $branches,
            'roles' => $roles,
        ]);
    }

    /**
     * Handle an incoming registration request.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|lowercase|email|max:255|unique:'.User::class,
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
            'branch_id' => 'required|exists:branches,id',
            'role_id' => [
                'required',
                'exists:roles,id',
                function (string $attribute, mixed $value, \Closure $fail) {
                    if ((int) $value === self::SUPERADMIN_ROLE_ID
                        && (int) auth()->user()?->role_id !== self::SUPERADMIN_ROLE_ID) {
                        $fail('Only a superadmin can create superadmin accounts.');
                    }
                },
            ],
        ]);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'branch_id' => $request->branch_id,
            'role_id' => $request->role_id,
            'status' => 'active',
        ]);

        event(new Registered($user));

        if (Auth::check()) {
            return redirect(route('user-management.index', absolute: false))
                ->with('success', 'User registered successfully.');
        }

        return redirect(route('login', absolute: false));
    }
}
