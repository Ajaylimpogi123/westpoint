import { Head, Link, useForm } from "@inertiajs/react";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login({ status, canResetPassword }) {
    const { data, setData, post, processing, errors, reset } = useForm({
        email: "",
        password: "",
        remember: false,
    });

    const submit = (e) => {
        e.preventDefault();
        post(route("login"), {
            onFinish: () => reset("password"),
        });
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
            <Head title="Sign in" />

            <div className="w-full max-w-sm">
                {/* Logo / Brand */}
                <div className="flex flex-col items-center mb-6">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-foreground mb-3">
                        <svg
                            className="text-background"
                            width="20"
                            height="20"
                            viewBox="0 0 20 20"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <rect x="2" y="6" width="16" height="11" rx="1.5" />
                            <path d="M6 6V5a4 4 0 018 0v1" />
                            <circle
                                cx="10"
                                cy="11.5"
                                r="1.5"
                                fill="currentColor"
                                stroke="none"
                            />
                        </svg>
                    </div>
                    <span className="text-sm font-semibold tracking-tight text-foreground">
                        Point of Sale
                    </span>
                    <span className="text-xs text-muted-foreground tracking-widest uppercase mt-0.5">
                        Staff sign-in
                    </span>
                </div>

                <Card className="shadow-none border border-border">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-base font-semibold">
                            Welcome back
                        </CardTitle>
                        <CardDescription className="text-sm">
                            Enter your credentials to access the terminal.
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        {/* Status message */}
                        {status && (
                            <div className="mb-4 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm font-medium text-green-700">
                                {status}
                            </div>
                        )}

                        <form
                            onSubmit={submit}
                            noValidate
                            className="space-y-4"
                        >
                            {/* Email */}
                            <div className="space-y-1.5">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    name="email"
                                    value={data.email}
                                    placeholder="staff@store.com"
                                    autoComplete="username"
                                    autoFocus
                                    onChange={(e) =>
                                        setData("email", e.target.value)
                                    }
                                    className={
                                        errors.email
                                            ? "border-destructive focus-visible:ring-destructive/30"
                                            : ""
                                    }
                                />
                                {errors.email && (
                                    <p className="text-xs text-destructive font-medium">
                                        {errors.email}
                                    </p>
                                )}
                            </div>

                            {/* Password */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password">Password</Label>
                                    {canResetPassword && (
                                        <Link
                                            href={route("password.request")}
                                            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
                                        >
                                            Forgot password?
                                        </Link>
                                    )}
                                </div>
                                <Input
                                    id="password"
                                    type="password"
                                    name="password"
                                    value={data.password}
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    onChange={(e) =>
                                        setData("password", e.target.value)
                                    }
                                    className={
                                        errors.password
                                            ? "border-destructive focus-visible:ring-destructive/30"
                                            : ""
                                    }
                                />
                                {errors.password && (
                                    <p className="text-xs text-destructive font-medium">
                                        {errors.password}
                                    </p>
                                )}
                            </div>

                            {/* Remember me */}
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="remember"
                                    name="remember"
                                    checked={data.remember}
                                    onCheckedChange={(checked) =>
                                        setData("remember", checked)
                                    }
                                />
                                <Label
                                    htmlFor="remember"
                                    className="text-sm font-normal text-muted-foreground cursor-pointer"
                                >
                                    Keep me signed in
                                </Label>
                            </div>

                            {/* Submit */}
                            <Button
                                type="submit"
                                className="w-full"
                                disabled={processing}
                            >
                                {processing ? (
                                    <span className="flex items-center gap-2">
                                        <svg
                                            className="animate-spin h-4 w-4"
                                            xmlns="http://www.w3.org/2000/svg"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                        >
                                            <circle
                                                className="opacity-25"
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                            />
                                            <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                            />
                                        </svg>
                                        Signing in…
                                    </span>
                                ) : (
                                    "Sign in"
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>


            </div>
        </div>
    );
}
