<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Inertia\Response;

class SuperadminDashboardController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('SuperadminDashboard');
    }
}
