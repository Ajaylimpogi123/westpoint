import { Head, Link, useForm } from "@inertiajs/react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Decorative capsule/pill shape used across the background layer.
// Purely visual — aria-hidden, no interaction.
function Capsule({ className, colorA, colorB, style }) {
    return (
        <svg
            viewBox="0 0 200 88"
            className={className}
            style={style}
            aria-hidden="true"
        >
            <defs>
                <linearGradient
                    id={`cap-${colorA}-${colorB}`}
                    x1="0"
                    y1="0"
                    x2="1"
                    y2="0"
                >
                    <stop offset="0%" stopColor={colorA} />
                    <stop offset="50%" stopColor={colorA} />
                    <stop offset="50%" stopColor={colorB} />
                    <stop offset="100%" stopColor={colorB} />
                </linearGradient>
            </defs>
            <rect
                x="4"
                y="4"
                width="192"
                height="80"
                rx="40"
                fill={`url(#cap-${colorA}-${colorB})`}
            />
            <rect
                x="4"
                y="4"
                width="192"
                height="80"
                rx="40"
                fill="none"
                stroke="rgba(255,255,255,0.18)"
                strokeWidth="1.5"
            />
            <ellipse
                cx="55"
                cy="26"
                rx="20"
                ry="9"
                fill="rgba(255,255,255,0.35)"
            />
        </svg>
    );
}

function Tablet({ className, color, style }) {
    return (
        <svg
            viewBox="0 0 100 100"
            className={className}
            style={style}
            aria-hidden="true"
        >
            <circle cx="50" cy="50" r="46" fill={color} opacity="0.9" />
            <circle
                cx="50"
                cy="50"
                r="46"
                fill="none"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="1.5"
            />
            <line
                x1="12"
                y1="50"
                x2="88"
                y2="50"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="2"
            />
            <ellipse
                cx="34"
                cy="30"
                rx="12"
                ry="6"
                fill="rgba(255,255,255,0.3)"
            />
        </svg>
    );
}

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
        <div className="wp-login relative min-h-screen flex items-center justify-center overflow-hidden bg-[#171B24] px-4">
            <Head title="Sign in" />

            {/* Ambient glow */}
            <div className="wp-orb wp-orb-a" aria-hidden="true" />
            <div className="wp-orb wp-orb-b" aria-hidden="true" />
            <div className="wp-grain" aria-hidden="true" />

            {/* Softgel / tablet field */}
            <div
                className="absolute inset-0 pointer-events-none"
                aria-hidden="true"
            >
                <Capsule
                    colorA="#FF6B6B"
                    colorB="#FFFFFF"
                    className="wp-cap absolute w-56 opacity-70 blur-[2px]"
                    style={{
                        top: "8%",
                        left: "6%",
                        transform: "rotate(-24deg)",
                        animationDelay: "0s",
                    }}
                />
                <Capsule
                    colorA="#4F9CF9"
                    colorB="#EAF1FF"
                    className="wp-cap absolute w-44 opacity-50 blur-[5px]"
                    style={{
                        top: "62%",
                        left: "-2%",
                        transform: "rotate(18deg)",
                        animationDelay: "-4s",
                    }}
                />
                <Capsule
                    colorA="#FFB020"
                    colorB="#FFF4DE"
                    className="wp-cap absolute w-48 opacity-55 blur-[4px]"
                    style={{
                        top: "4%",
                        right: "4%",
                        transform: "rotate(32deg)",
                        animationDelay: "-8s",
                    }}
                />
                <Capsule
                    colorA="#3DDC97"
                    colorB="#EAFBF3"
                    className="wp-cap absolute w-52 opacity-60 blur-[3px]"
                    style={{
                        bottom: "6%",
                        right: "2%",
                        transform: "rotate(-16deg)",
                        animationDelay: "-2s",
                    }}
                />
                <Capsule
                    colorA="#B98CFF"
                    colorB="#F3ECFF"
                    className="wp-cap absolute w-36 opacity-40 blur-[6px]"
                    style={{
                        bottom: "16%",
                        left: "18%",
                        transform: "rotate(8deg)",
                        animationDelay: "-6s",
                    }}
                />

                <Tablet
                    color="#4F9CF9"
                    className="wp-tab absolute w-10 opacity-40 blur-[2px]"
                    style={{ top: "22%", left: "30%", animationDelay: "-1s" }}
                />
                <Tablet
                    color="#FF6B6B"
                    className="wp-tab absolute w-8 opacity-35 blur-[3px]"
                    style={{ bottom: "28%", left: "8%", animationDelay: "-5s" }}
                />
                <Tablet
                    color="#FFB020"
                    className="wp-tab absolute w-9 opacity-40 blur-[2px]"
                    style={{ top: "14%", right: "26%", animationDelay: "-3s" }}
                />
                <Tablet
                    color="#3DDC97"
                    className="wp-tab absolute w-7 opacity-30 blur-[3px]"
                    style={{
                        bottom: "10%",
                        right: "22%",
                        animationDelay: "-7s",
                    }}
                />
            </div>

            <div className="relative z-10 w-full max-w-[400px]">
                {/* Brand */}
                <div className="flex flex-col items-center mb-8">
                    <div className="flex items-center justify-center w-64 h-36 rounded-2xl bg-white/[0.06] border border-white/10 shadow-[0_8px_30px_-12px_rgba(79,156,249,0.25)] backdrop-blur-xl mb-4">
                        <img
                            src="/images/logo/Westpoint.png"
                            alt="Westpoint"
                            className="w-full h-28 object-contain rounded-lg"
                        />
                    </div>
                    <span className="wp-display text-[#F1F2F6] text-lg tracking-tight">
                        Westpoint
                    </span>
                    <span className="text-xs text-[#8C93A5] mt-0.5">
                        Pharmacy Point of Sale
                    </span>
                </div>

                {/* Glass card */}
                <div className="wp-card rounded-3xl border border-white/10 bg-white/[0.05] backdrop-blur-2xl shadow-[0_24px_70px_-20px_rgba(0,0,0,0.5)] px-7 py-8">
                    <h1 className="wp-display text-[#F1F2F6] text-2xl tracking-tight mb-1 text-center">
                        Welcome back
                    </h1>
                    <p className="text-sm text-[#8C93A5] mb-7 text-center">
                        Sign in to continue
                    </p>

                    {status && (
                        <div className="mb-5 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.07] px-3.5 py-2.5 text-sm text-emerald-300">
                            {status}
                        </div>
                    )}

                    <form onSubmit={submit} noValidate className="space-y-4">
                        <div className="space-y-1.5">
                            <Label
                                htmlFor="email"
                                className="text-xs font-medium text-[#A6ADBE]"
                            >
                                Email
                            </Label>
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
                                className={`h-11 rounded-xl border-white/10 bg-white/[0.04] text-[#F1F2F6] placeholder:text-[#5F6577] focus-visible:ring-2 focus-visible:ring-[#4F9CF9]/35 focus-visible:border-[#4F9CF9]/50 ${
                                    errors.email
                                        ? "border-red-400/40 focus-visible:ring-red-400/20"
                                        : ""
                                }`}
                            />
                            {errors.email && (
                                <p className="text-xs text-red-400 font-medium">
                                    {errors.email}
                                </p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label
                                    htmlFor="password"
                                    className="text-xs font-medium text-[#A6ADBE]"
                                >
                                    Password
                                </Label>
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
                                className={`h-11 rounded-xl border-white/10 bg-white/[0.04] text-[#F1F2F6] placeholder:text-[#5F6577] focus-visible:ring-2 focus-visible:ring-[#4F9CF9]/35 focus-visible:border-[#4F9CF9]/50 ${
                                    errors.password
                                        ? "border-red-400/40 focus-visible:ring-red-400/20"
                                        : ""
                                }`}
                            />
                            {errors.password && (
                                <p className="text-xs text-red-400 font-medium">
                                    {errors.password}
                                </p>
                            )}
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                            <Checkbox
                                id="remember"
                                name="remember"
                                checked={data.remember}
                                onCheckedChange={(checked) =>
                                    setData("remember", checked)
                                }
                                className="border-white/15 data-[state=checked]:bg-[#4F9CF9] data-[state=checked]:border-[#4F9CF9]"
                            />
                            <Label
                                htmlFor="remember"
                                className="text-sm font-normal text-[#8C93A5] cursor-pointer"
                            >
                                Keep me signed in
                            </Label>
                        </div>

                        <Button
                            type="submit"
                            disabled={processing}
                            className="wp-cta w-full h-11 rounded-xl text-white font-medium border-0 mt-2"
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
                </div>

                <p className="text-center text-xs text-[#5F6577] mt-6">
                    Westpoint Pharmacy POS
                </p>
            </div>

            <style>{`
                .wp-display {
                    font-family: 'Space Grotesk', 'Inter', sans-serif;
                    font-weight: 500;
                }

                .wp-orb {
                    position: absolute;
                    border-radius: 9999px;
                    filter: blur(110px);
                    opacity: 0.22;
                    pointer-events: none;
                }
                .wp-orb-a {
                    width: 560px;
                    height: 560px;
                    top: -200px;
                    left: -160px;
                    background: radial-gradient(circle, #4F9CF9 0%, transparent 70%);
                }
                .wp-orb-b {
                    width: 480px;
                    height: 480px;
                    bottom: -220px;
                    right: -140px;
                    background: radial-gradient(circle, #FF6B6B 0%, transparent 70%);
                    opacity: 0.16;
                }

                .wp-grain {
                    position: absolute;
                    inset: 0;
                    opacity: 0.035;
                    pointer-events: none;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
                }

                .wp-cap {
                    animation: wp-drift 14s ease-in-out infinite;
                    filter: drop-shadow(0 10px 20px rgba(0,0,0,0.25));
                }
                .wp-tab {
                    animation: wp-drift-fast 10s ease-in-out infinite;
                }
                @keyframes wp-drift {
                    0%, 100% { transform: translate(0, 0) rotate(var(--r, 0deg)); }
                    50%      { transform: translate(14px, -12px) rotate(calc(var(--r, 0deg) + 4deg)); }
                }
                @keyframes wp-drift-fast {
                    0%, 100% { transform: translate(0, 0); }
                    50%      { transform: translate(-10px, 10px); }
                }

                .wp-card {
                    animation: wp-card-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
                }
                @keyframes wp-card-in {
                    from { opacity: 0; transform: translateY(10px); }
                    to   { opacity: 1; transform: translateY(0); }
                }

                .wp-cta {
                    background: linear-gradient(135deg, #4F9CF9 0%, #7C6CFF 100%);
                    transition: filter 0.2s ease, transform 0.15s ease;
                }
                .wp-cta:hover {
                    filter: brightness(1.08);
                }
                .wp-cta:active {
                    transform: scale(0.98);
                }

                @media (prefers-reduced-motion: reduce) {
                    .wp-cap, .wp-tab, .wp-card { animation: none; }
                }
            `}</style>
        </div>
    );
}
