<?php

namespace App\Http\Controllers;


use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Redirect;
use Inertia\Inertia;
use Inertia\Response;
use App\Models\User;

use Illuminate\Support\Facades\Storage;
class UserController extends Controller
{
    public function index(Request $request)
{

 $search = $request->input('search');

 $users = User::when($search, function ($query, $search) {
            $query->where(function ($query) use ($search) {
                $query->where('name', 'like', "%{$search}%")
                      ->orWhere('email', 'like', "%{$search}%");
            });
        })
        ->orderBy('created_at', 'desc')
        ->get();

    return Inertia::render('User/Index', [
        'users' => $users,
        'filters' => $request->only(['search']),

    ]);
}
}
