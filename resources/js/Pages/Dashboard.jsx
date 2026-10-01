import { useMemo } from "react";
import { format } from "date-fns";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head, router } from "@inertiajs/react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import InputLabel from "@/components/InputLabel";
import { DollarSign, Receipt } from "lucide-react";
import RevenueTrendChart from "./Dashboard/Partials/RevenueTrendChart";
import ProductBreakdownChart from "./Dashboard/Partials/ProductBreakdownChart";
import BranchComparisonChart from "./Dashboard/Partials/BranchComparisonChart";
import { getPackSize } from "@/lib/units";
import {
    ALL_PAYMENT_METHODS,
    resolvePaymentMethodOptions,
} from "@/lib/paymentMethods";

function formatCurrency(amount) {
    return `₱${Number(amount).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function formatCount(value) {
    return Number(value ?? 0).toLocaleString();
}

/**
 * Today in the browser's local timezone. toISOString() is UTC, which in the
 * Philippines (UTC+8) picked yesterday's date before 08:00.
 */
function defaultStatsDate(statsPeriod) {
    return format(new Date(), statsPeriod === "monthly" ? "yyyy-MM" : "yyyy-MM-dd");
}

/** Keep the user's selected day/month when switching between periods. */
function carryStatsDate(currentDate, nextPeriod) {
    if (!currentDate) {
        return defaultStatsDate(nextPeriod);
    }

    if (nextPeriod === "monthly") {
        return /^\d{4}-\d{2}/.test(currentDate)
            ? currentDate.slice(0, 7)
            : defaultStatsDate(nextPeriod);
    }

    return /^\d{4}-\d{2}-\d{2}$/.test(currentDate)
        ? currentDate
        : defaultStatsDate(nextPeriod);
}

/** "2 box + 5 pcs" when pack_size makes a box equivalent meaningful. */
function boxEquivalent(medicine) {
    const packSize = getPackSize(medicine);
    const pieces = Number(medicine?.total_quantity ?? 0);

    if (packSize <= 1 || pieces < packSize) {
        return null;
    }

    const boxes = Math.floor(pieces / packSize);
    const remainder = pieces % packSize;

    return remainder > 0
        ? `${boxes.toLocaleString()} box + ${remainder} pcs`
        : `${boxes.toLocaleString()} box`;
}

function StatsCard({
    title,
    value,
    icon: Icon,
    iconColor,
    iconBg,
    subtitle,
    footnote,
}) {
    return (
        <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-sm text-muted-foreground">{title}</p>
                        {subtitle && (
                            <p className="mt-1 text-xs text-muted-foreground">
                                {subtitle}
                            </p>
                        )}
                        <p className="mt-2 text-3xl font-bold tracking-tight">
                            {value}
                        </p>
                        {footnote && (
                            <p className="mt-1 text-xs text-muted-foreground">
                                {footnote}
                            </p>
                        )}
                    </div>
                    <div className={`rounded-lg p-3 ${iconBg}`}>
                        <Icon className={`h-6 w-6 ${iconColor}`} />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

const STATS_PERIOD_OPTIONS = [
    { value: "all", label: "All Time" },
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
];

function statsCardTitle(baseTitle, statsPeriod) {
    if (statsPeriod === "all") {
        return baseTitle;
    }

    return baseTitle.replace(
        "Total",
        statsPeriod.charAt(0).toUpperCase() + statsPeriod.slice(1),
    );
}

function buildStatsSubtitle(statsPeriodLabel, paymentMethodLabel) {
    const parts = [statsPeriodLabel, paymentMethodLabel].filter(Boolean);

    return parts.length > 0 ? parts.join(" · ") : null;
}

export default function Dashboard({
    stats,
    topMedicines = [],
    branchPerformance = [],
    charts = {},
    branches = [],
    filters = {},
    statsPeriodLabel = null,
    paymentMethodLabel = null,
    paymentMethods = [],
    canViewAllBranches = false,
    branchName = null,
    dashboardRoute = "dashboard",
}) {
    const selectedBranchId = String(filters?.branch_id ?? "all");
    const selectedStatsPeriod = filters?.stats_period ?? "all";
    const selectedStatsDate =
        filters?.stats_date ?? defaultStatsDate(selectedStatsPeriod);
    const selectedPaymentMethod =
        filters?.payment_method ?? ALL_PAYMENT_METHODS;
    const statsSubtitle = buildStatsSubtitle(
        statsPeriodLabel,
        paymentMethodLabel,
    );

    const paymentOptions = useMemo(
        () => resolvePaymentMethodOptions(paymentMethods),
        [paymentMethods],
    );

    const totalRefunded = Number(stats?.totalRefunded ?? 0);
    const voidedTransactions = Number(stats?.voidedTransactions ?? 0);

    const applyFilters = (overrides = {}) => {
        const params = {
            branch_id: selectedBranchId,
            stats_period: selectedStatsPeriod,
            stats_date: selectedStatsDate,
            payment_method: selectedPaymentMethod,
            ...overrides,
        };

        if (params.stats_period === "all" || !params.stats_date) {
            delete params.stats_date;
        }

        if (params.payment_method === ALL_PAYMENT_METHODS) {
            delete params.payment_method;
        }

        if (!canViewAllBranches || params.branch_id === "all") {
            delete params.branch_id;
        }

        router.get(route(dashboardRoute), params, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    const handleBranchChange = (branchId) => {
        applyFilters({ branch_id: branchId });
    };

    const handleStatsPeriodChange = (statsPeriod) => {
        applyFilters({
            stats_period: statsPeriod,
            stats_date: carryStatsDate(
                selectedStatsPeriod === "all" ? null : selectedStatsDate,
                statsPeriod,
            ),
        });
    };

    const handleStatsDateChange = (statsDate) => {
        // Clearing a date input fires onChange with ""; ignore it rather
        // than sending an empty filter that silently resets to today.
        if (!statsDate) {
            return;
        }

        applyFilters({ stats_date: statsDate });
    };

    const handlePaymentMethodChange = (paymentMethod) => {
        applyFilters({ payment_method: paymentMethod });
    };

    const scopeLabel = canViewAllBranches
        ? selectedBranchId === "all"
            ? "All Branches"
            : branchName
        : branchName;

    return (
        <AuthenticatedLayout>
            <Head title="Sales Dashboard" />

            <div className="relative z-10 py-8">
                <div className="mx-auto w-full min-w-0 max-w-full space-y-6 px-4 sm:px-6 lg:px-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">
                            Sales Dashboard
                        </h1>
                        <p className="mt-2 text-sm text-white/80">
                            {canViewAllBranches
                                ? "Overview of sales performance across branches."
                                : `Sales overview for ${branchName ?? "your branch"}.`}
                        </p>
                    </div>

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                        <div className="w-full sm:w-48">
                            <InputLabel
                                htmlFor="stats_period"
                                value="Stats Period"
                            />
                            <select
                                id="stats_period"
                                name="stats_period"
                                value={selectedStatsPeriod}
                                onChange={(e) =>
                                    handleStatsPeriodChange(e.target.value)
                                }
                                className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            >
                                {STATS_PERIOD_OPTIONS.map((option) => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {selectedStatsPeriod === "daily" && (
                            <div className="w-full sm:w-48">
                                <InputLabel htmlFor="stats_date" value="Date" />
                                <input
                                    id="stats_date"
                                    name="stats_date"
                                    type="date"
                                    value={selectedStatsDate}
                                    onChange={(e) =>
                                        handleStatsDateChange(e.target.value)
                                    }
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </div>
                        )}

                        {selectedStatsPeriod === "weekly" && (
                            <div className="w-full sm:w-48">
                                <InputLabel
                                    htmlFor="stats_week"
                                    value="Week Of"
                                />
                                <input
                                    id="stats_week"
                                    name="stats_week"
                                    type="date"
                                    value={selectedStatsDate}
                                    onChange={(e) =>
                                        handleStatsDateChange(e.target.value)
                                    }
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </div>
                        )}

                        {selectedStatsPeriod === "monthly" && (
                            <div className="w-full sm:w-48">
                                <InputLabel
                                    htmlFor="stats_month"
                                    value="Month"
                                />
                                <input
                                    id="stats_month"
                                    name="stats_month"
                                    type="month"
                                    value={selectedStatsDate}
                                    onChange={(e) =>
                                        handleStatsDateChange(e.target.value)
                                    }
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </div>
                        )}

                        <div className="w-full sm:w-48">
                            <InputLabel
                                htmlFor="payment_method"
                                value="Payment Method"
                            />
                            <select
                                id="payment_method"
                                name="payment_method"
                                value={selectedPaymentMethod}
                                onChange={(e) =>
                                    handlePaymentMethodChange(e.target.value)
                                }
                                className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            >
                                <option value={ALL_PAYMENT_METHODS}>
                                    All payment methods
                                </option>
                                {paymentOptions.map((option) => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {canViewAllBranches && (
                            <div className="w-full sm:w-48">
                                <InputLabel
                                    htmlFor="branch_id"
                                    value="Branch"
                                />
                                <select
                                    id="branch_id"
                                    name="branch_id"
                                    value={selectedBranchId}
                                    onChange={(e) =>
                                        handleBranchChange(e.target.value)
                                    }
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                >
                                    <option value="all">All Branches</option>
                                    {branches.map((branch) => (
                                        <option
                                            key={branch.id}
                                            value={branch.id}
                                        >
                                            {branch.branch_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {scopeLabel && (
                        <p className="text-sm font-medium text-white/90">
                            Viewing:{" "}
                            <span className="text-white">{scopeLabel}</span>
                            {statsPeriodLabel && (
                                <>
                                    {" "}
                                    · Period:{" "}
                                    <span className="text-white">
                                        {statsPeriodLabel}
                                    </span>
                                </>
                            )}
                            {paymentMethodLabel && (
                                <>
                                    {" "}
                                    · Payment:{" "}
                                    <span className="text-white">
                                        {paymentMethodLabel}
                                    </span>
                                </>
                            )}
                        </p>
                    )}

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <StatsCard
                            title={statsCardTitle(
                                "Total Revenue",
                                selectedStatsPeriod,
                            )}
                            subtitle={statsSubtitle}
                            value={formatCurrency(stats?.totalRevenue ?? 0)}
                            footnote={
                                totalRefunded > 0
                                    ? `Net of ${formatCurrency(totalRefunded)} refunded`
                                    : "Net of refunds, excludes voided sales"
                            }
                            icon={DollarSign}
                            iconColor="text-green-600"
                            iconBg="bg-green-50"
                        />
                        <StatsCard
                            title={statsCardTitle(
                                "Total Transactions",
                                selectedStatsPeriod,
                            )}
                            subtitle={statsSubtitle}
                            value={formatCount(stats?.totalTransactions)}
                            footnote={
                                voidedTransactions > 0
                                    ? `Excludes ${formatCount(voidedTransactions)} voided`
                                    : "Excludes voided sales"
                            }
                            icon={Receipt}
                            iconColor="text-blue-600"
                            iconBg="bg-blue-50"
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <RevenueTrendChart
                            labels={charts?.revenueTrend?.labels ?? []}
                            values={charts?.revenueTrend?.values}
                            period={charts?.revenueTrend?.period ?? "monthly"}
                            paymentLabel={paymentMethodLabel}
                        />
                        <ProductBreakdownChart
                            labels={charts?.productBreakdown?.labels ?? []}
                            values={charts?.productBreakdown?.values}
                            subtitle={statsSubtitle}
                        />
                    </div>

                    {canViewAllBranches && charts?.branchComparison && (
                        <BranchComparisonChart
                            labels={charts.branchComparison.labels ?? []}
                            values={charts.branchComparison.values}
                            subtitle={statsSubtitle}
                        />
                    )}

                    <Card className="border-0 shadow-sm">
                        <CardHeader>
                            <CardTitle>Top Selling Medicines</CardTitle>
                            <CardDescription>
                                Ranked by pieces sold, net of returns
                                {statsSubtitle ? ` · ${statsSubtitle}` : ""}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {topMedicines.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    No medicine sales found for the selected
                                    filters.
                                </p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-12">
                                                #
                                            </TableHead>
                                            <TableHead>Medicine</TableHead>
                                            <TableHead>Brand</TableHead>
                                            <TableHead className="text-right">
                                                Qty (pcs)
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Net Revenue
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {topMedicines.map((medicine, index) => {
                                            const boxes = boxEquivalent(medicine);

                                            return (
                                            <TableRow key={medicine.id}>
                                                <TableCell className="font-medium">
                                                    {index + 1}
                                                </TableCell>
                                                <TableCell>
                                                    {medicine.name}
                                                </TableCell>
                                                <TableCell>
                                                    {medicine.brand_name || "—"}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {formatCount(
                                                        medicine.total_quantity,
                                                    )}
                                                    {boxes && (
                                                        <span className="block text-xs text-muted-foreground">
                                                            {boxes}
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right font-medium text-green-600">
                                                    {formatCurrency(
                                                        medicine.total_revenue,
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>

                    {canViewAllBranches && (
                        <Card className="border-0 shadow-sm">
                            <CardHeader>
                                <CardTitle>Performance Breakdown</CardTitle>
                                <CardDescription>
                                    All active branches
                                    {statsSubtitle ? ` · ${statsSubtitle}` : ""}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {branchPerformance.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        No active branches to compare.
                                    </p>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Branch</TableHead>
                                                <TableHead className="text-right">
                                                    Net Revenue
                                                </TableHead>
                                                <TableHead className="text-right">
                                                    Transactions
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {branchPerformance.map((branch) => (
                                                <TableRow key={branch.id}>
                                                    <TableCell className="font-medium">
                                                        {branch.branch_name}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium text-green-600">
                                                        {formatCurrency(
                                                            branch.total_revenue,
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {formatCount(
                                                            branch.transaction_count,
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
