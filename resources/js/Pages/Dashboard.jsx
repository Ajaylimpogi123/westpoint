import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Head, router } from "@inertiajs/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import InputLabel from "@/Components/InputLabel";
import { DollarSign, Receipt } from "lucide-react";
import RevenueTrendChart from "./Dashboard/Partials/RevenueTrendChart";
import ProductBreakdownChart from "./Dashboard/Partials/ProductBreakdownChart";
import BranchComparisonChart from "./Dashboard/Partials/BranchComparisonChart";

function formatCurrency(amount) {
    return `₱${Number(amount).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function StatsCard({ title, value, icon: Icon, iconColor, iconBg, subtitle }) {
    return (
        <Card className="border-0 shadow-sm">
            <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-sm text-muted-foreground">{title}</p>
                        {subtitle && (
                            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
                        )}
                        <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
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

    return baseTitle.replace("Total", statsPeriod.charAt(0).toUpperCase() + statsPeriod.slice(1));
}

export default function Dashboard({
    stats,
    topMedicines = [],
    branchPerformance = [],
    charts = {},
    branches = [],
    filters = {},
    statsPeriodLabel = null,
    canViewAllBranches = false,
    branchName = null,
    dashboardRoute = "dashboard",
}) {
    const selectedBranchId = filters?.branch_id ?? "all";
    const selectedStatsPeriod = filters?.stats_period ?? "all";
    const selectedStatsDate =
        filters?.stats_date ??
        (selectedStatsPeriod === "monthly"
            ? new Date().toISOString().slice(0, 7)
            : new Date().toISOString().slice(0, 10));

    const buildFilterParams = (overrides = {}) => ({
        branch_id: overrides.branch_id ?? selectedBranchId,
        stats_period: overrides.stats_period ?? selectedStatsPeriod,
        stats_date:
            (overrides.stats_period ?? selectedStatsPeriod) === "all"
                ? undefined
                : overrides.stats_date ?? selectedStatsDate,
    });

    const applyFilters = (overrides = {}) => {
        const params = buildFilterParams(overrides);

        if (params.stats_period === "all") {
            delete params.stats_date;
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
            stats_date:
                statsPeriod === "monthly"
                    ? new Date().toISOString().slice(0, 7)
                    : new Date().toISOString().slice(0, 10),
        });
    };

    const handleStatsDateChange = (statsDate) => {
        applyFilters({ stats_date: statsDate });
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
                <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
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

                        {canViewAllBranches && (
                            <div className="w-full sm:w-64">
                                <InputLabel htmlFor="branch_id" value="Branch" />
                                <select
                                    id="branch_id"
                                    name="branch_id"
                                    value={selectedBranchId}
                                    onChange={(e) => handleBranchChange(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                >
                                    <option value="all">All Branches</option>
                                    {branches.map((branch) => (
                                        <option key={branch.id} value={branch.id}>
                                            {branch.branch_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                        <div className="w-full sm:w-48">
                            <InputLabel htmlFor="stats_period" value="Stats Period" />
                            <select
                                id="stats_period"
                                name="stats_period"
                                value={selectedStatsPeriod}
                                onChange={(e) => handleStatsPeriodChange(e.target.value)}
                                className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            >
                                {STATS_PERIOD_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
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
                                    onChange={(e) => handleStatsDateChange(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </div>
                        )}

                        {selectedStatsPeriod === "weekly" && (
                            <div className="w-full sm:w-48">
                                <InputLabel htmlFor="stats_week" value="Week Of" />
                                <input
                                    id="stats_week"
                                    name="stats_week"
                                    type="date"
                                    value={selectedStatsDate}
                                    onChange={(e) => handleStatsDateChange(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </div>
                        )}

                        {selectedStatsPeriod === "monthly" && (
                            <div className="w-full sm:w-48">
                                <InputLabel htmlFor="stats_month" value="Month" />
                                <input
                                    id="stats_month"
                                    name="stats_month"
                                    type="month"
                                    value={selectedStatsDate}
                                    onChange={(e) => handleStatsDateChange(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 bg-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </div>
                        )}
                    </div>

                    {scopeLabel && (
                        <p className="text-sm font-medium text-white/90">
                            Viewing: <span className="text-white">{scopeLabel}</span>
                            {statsPeriodLabel && (
                                <>
                                    {" "}
                                    · Stats:{" "}
                                    <span className="text-white">{statsPeriodLabel}</span>
                                </>
                            )}
                        </p>
                    )}

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <StatsCard
                            title={statsCardTitle("Total Revenue", selectedStatsPeriod)}
                            subtitle={statsPeriodLabel}
                            value={formatCurrency(stats?.totalRevenue ?? 0)}
                            icon={DollarSign}
                            iconColor="text-green-600"
                            iconBg="bg-green-50"
                        />
                        <StatsCard
                            title={statsCardTitle("Total Transactions", selectedStatsPeriod)}
                            subtitle={statsPeriodLabel}
                            value={Number(stats?.totalTransactions ?? 0).toLocaleString()}
                            icon={Receipt}
                            iconColor="text-blue-600"
                            iconBg="bg-blue-50"
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        <RevenueTrendChart
                            labels={charts?.revenueTrend?.labels ?? []}
                            values={charts?.revenueTrend?.values ?? []}
                            period={charts?.revenueTrend?.period ?? "monthly"}
                        />
                        <ProductBreakdownChart
                            labels={charts?.productBreakdown?.labels ?? []}
                            values={charts?.productBreakdown?.values ?? []}
                        />
                    </div>

                    {canViewAllBranches && charts?.branchComparison && (
                        <BranchComparisonChart
                            labels={charts.branchComparison.labels ?? []}
                            values={charts.branchComparison.values ?? []}
                        />
                    )}

                    <Card className="border-0 shadow-sm">
                        <CardHeader>
                            <CardTitle>Top Selling Medicines</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {topMedicines.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    No sales recorded yet for this scope.
                                </p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-12">#</TableHead>
                                            <TableHead>Medicine</TableHead>
                                            <TableHead>Brand</TableHead>
                                            <TableHead className="text-right">Qty Sold</TableHead>
                                            <TableHead className="text-right">Revenue</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {topMedicines.map((medicine, index) => (
                                            <TableRow key={medicine.id}>
                                                <TableCell className="font-medium">
                                                    {index + 1}
                                                </TableCell>
                                                <TableCell>{medicine.name}</TableCell>
                                                <TableCell>{medicine.brand_name || "—"}</TableCell>
                                                <TableCell className="text-right">
                                                    {medicine.total_quantity.toLocaleString()}
                                                </TableCell>
                                                <TableCell className="text-right font-medium text-green-600">
                                                    {formatCurrency(medicine.total_revenue)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>

                    {canViewAllBranches && (
                        <Card className="border-0 shadow-sm">
                            <CardHeader>
                                <CardTitle>Performance Breakdown</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {branchPerformance.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        No branch sales data available yet.
                                    </p>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Branch</TableHead>
                                                <TableHead className="text-right">
                                                    Total Revenue
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
                                                        {formatCurrency(branch.total_revenue)}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {branch.transaction_count.toLocaleString()}
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
