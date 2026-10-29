<?php

namespace App\Http\Controllers;

use PDOException;
use Throwable;

abstract class Controller
{
    /**
     * The exception's message for the user, except database errors: those
     * are logged and replaced by $fallback so SQL never reaches the screen.
     * (QueryException is a RuntimeException, so `catch (\RuntimeException)`
     * blocks meant for business-rule messages also catch it.)
     */
    protected function userMessage(Throwable $exception, string $fallback): string
    {
        if ($exception instanceof PDOException) {
            report($exception);

            return $fallback;
        }

        return $exception->getMessage();
    }
}
