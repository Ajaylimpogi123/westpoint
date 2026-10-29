<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Keeps the session in step with the users row on every request.
 *
 * Controllers scope data by session('role_id') / session('branch_id'), which
 * used to be written only at login. A user re-authenticated by the
 * remember-me cookie got an empty session, and a demoted, moved or
 * deactivated user kept their old powers until they logged out. Calling
 * Auth::check() here also resolves the remember-me cookie, so both paths are
 * covered before any controller runs.
 */
class EnsureActiveUserSession
{
    public const DEACTIVATED_MESSAGE = 'This account has been deactivated. Please contact an administrator.';

    public function handle(Request $request, Closure $next): Response
    {
        if (! Auth::check()) {
            return $next($request);
        }

        $user = Auth::user();

        if ($user->status === 'inactive') {
            Auth::guard('web')->logout();

            if ($request->hasSession()) {
                $request->session()->invalidate();
                $request->session()->regenerateToken();
            }

            if ($request->expectsJson() && ! $request->header('X-Inertia')) {
                return response()->json(['message' => self::DEACTIVATED_MESSAGE], 401);
            }

            return redirect()->route('login')->withErrors(['email' => self::DEACTIVATED_MESSAGE]);
        }

        if ($request->hasSession()) {
            $session = $request->session();
            $roleId = $user->role_id !== null ? (int) $user->role_id : null;
            $branchId = $user->branch_id !== null ? (int) $user->branch_id : null;

            if ($session->get('role_id') !== $roleId) {
                $session->put('role_id', $roleId);
            }

            // Missing (remember-me login) or stale -> the user's branch.
            $sessionBranch = $session->get('branch_id');
            $sessionBranch = $sessionBranch !== null ? (int) $sessionBranch : null;

            if (! $session->exists('branch_id') || $sessionBranch !== $branchId) {
                $session->put('branch_id', $branchId);
            }
        }

        return $next($request);
    }
}
