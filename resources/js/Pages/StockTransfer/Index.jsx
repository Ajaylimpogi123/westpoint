import { useEffect, useState } from "react";
import { Head, usePage } from "@inertiajs/react";
import { toast } from "sonner";
import AuthenticatedLayout from "@/Layouts/AuthenticatedLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Hooks
import { useStockTransferForm } from "./Hooks/useStockTransferForm";
import { useStockTransferList } from "./Hooks/useStockTransferList";
import { useApproval } from "./Hooks/useApproval";

// Partials
import TransferWizard from "./Partials/TransferWizard";
import TransfersTable from "./Partials/TransfersTable";
import ApprovalCard from "./Partials/ApprovalCard";
import TransferDetailModal from "./Partials/TransferDetailModal";

export default function Index({
    transfers,
    pendingTransfers = [],
    filters = {},
    canViewAll = false,
    canApprove = false,
    canChooseSource = false,
    currentUserId,
    products = [],
    branches = [],
    userBranch,
}) {
    const {
        props: { flash, errors },
    } = usePage();

    // Flash toasts — useEffect prevents firing on every re-render
    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash]);

    // Approve / reject / cancel failures come back as errors.status (e.g.
    // not enough stock left in the lot). They used to be dropped silently.
    useEffect(() => {
        if (errors?.status) toast.error(errors.status);
    }, [errors?.status]);

    const [detailTransfer, setDetailTransfer] = useState(null);

    const wizardForm = useStockTransferForm({
        userBranch,
        products,
        canChooseSource,
    });
    const listState = useStockTransferList({
        initialSearch: filters.search ?? "",
        initialStatus: filters.status ?? "all",
    });
    const approval = useApproval();

    const hasFilters = Boolean(filters.search) || (filters.status ?? "all") !== "all";
    const listTab = canViewAll ? "all" : "my-requests";
    const [tab, setTab] = useState(
        hasFilters ? listTab : canViewAll ? "pending" : "new-request",
    );

    return (
        <AuthenticatedLayout
            header={
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-800">
                        Stock Transfers
                    </h2>
                    {canViewAll && pendingTransfers.length > 0 && (
                        <span
                            className="inline-flex items-center gap-1.5 text-xs
                            px-2.5 py-1 rounded-full bg-yellow-100
                            text-yellow-700 font-medium"
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                            {pendingTransfers.length} pending approval
                        </span>
                    )}
                </div>
            }
        >
            <Head title="Stock Transfers" />

            <div className="relative z-10 py-8">
                <div className="mx-auto w-full min-w-0 max-w-full space-y-6 px-4 sm:px-6 lg:px-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">
                            Stock Transfer
                        </h1>
                        <p className="mt-2 text-sm text-white">
                            Request stock from one branch to another, approve
                            requests, and review transfer activity.
                        </p>
                    </div>

                    <Tabs value={tab} onValueChange={setTab} className="space-y-6">
                        {/* ── Tab triggers ──────────────────────────── */}
                        <TabsList
                            className={`grid h-auto w-full grid-cols-1 gap-2 bg-white/10 p-1 ${
                                canViewAll ? "sm:grid-cols-3" : "sm:grid-cols-2"
                            }`}
                        >
                            {canViewAll && (
                                <TabsTrigger value="pending" className="gap-2">
                                    Pending
                                    {pendingTransfers.length > 0 && (
                                        <span
                                            className="inline-flex items-center justify-center
                                            min-w-5 h-5 px-1 text-[10px] font-bold rounded-full
                                            bg-yellow-400 text-yellow-900"
                                        >
                                            {pendingTransfers.length}
                                        </span>
                                    )}
                                </TabsTrigger>
                            )}
                            <TabsTrigger value={listTab}>
                                {canViewAll ? "All Requests" : "My Requests"}
                            </TabsTrigger>
                            <TabsTrigger value="new-request">
                                + New Request
                            </TabsTrigger>
                        </TabsList>

                        {/* New Request — wizard */}
                        <TabsContent value="new-request">
                            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                                <div className="mb-5">
                                    <h3 className="text-sm font-semibold text-gray-800">
                                        New stock transfer request
                                    </h3>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        Select medicine → choose lot → enter
                                        destination. Stock moves only after an
                                        admin approves the request.
                                    </p>
                                </div>

                                <TransferWizard
                                    step={wizardForm.step}
                                    goNext={wizardForm.goNext}
                                    goBack={wizardForm.goBack}
                                    data={wizardForm.data}
                                    setData={wizardForm.setData}
                                    errors={wizardForm.errors}
                                    processing={wizardForm.processing}
                                    selectedItems={wizardForm.selectedItems}
                                    addItem={wizardForm.addItem}
                                    removeItem={wizardForm.removeItem}
                                    submit={wizardForm.submit}
                                    products={wizardForm.products}
                                    productsLoading={wizardForm.productsLoading}
                                    productsError={wizardForm.productsError}
                                    retryProducts={wizardForm.retryProducts}
                                    canChooseSource={canChooseSource}
                                    changeSourceBranch={
                                        wizardForm.changeSourceBranch
                                    }
                                    branches={branches}
                                />
                            </div>
                        </TabsContent>

                        {/* My Requests / All Requests — list */}
                        <TabsContent value={listTab}>
                            <div className="space-y-4">
                                <SearchBar listState={listState} />
                                <TransfersTable
                                    transfers={transfers}
                                    isAdmin={canViewAll}
                                    currentUserId={currentUserId}
                                    onCancel={approval.cancel}
                                    onView={setDetailTransfer}
                                />
                            </div>
                        </TabsContent>

                        {/* Pending — approval cards (admin acts, superadmin views) */}
                        {canViewAll && (
                            <TabsContent value="pending">
                                <div className="space-y-4">
                                    {pendingTransfers.length === 0 ? (
                                        <EmptyState message="No pending transfer requests." />
                                    ) : (
                                        pendingTransfers.map((transfer) => (
                                            <ApprovalCard
                                                key={transfer.id}
                                                transfer={transfer}
                                                approval={approval}
                                                canApprove={canApprove}
                                                onView={setDetailTransfer}
                                            />
                                        ))
                                    )}
                                </div>
                            </TabsContent>
                        )}
                    </Tabs>
                </div>
            </div>

            {/* Detail modal */}
            {detailTransfer && (
                <TransferDetailModal
                    transfer={detailTransfer}
                    onClose={() => setDetailTransfer(null)}
                />
            )}
        </AuthenticatedLayout>
    );
}

// ─────────────────────────────────────────────────────────────────────
// Search + status filter bar
// ─────────────────────────────────────────────────────────────────────
function SearchBar({ listState }) {
    const {
        search,
        setSearch,
        statusFilter,
        setStatusFilter,
        applyFilters,
        clearFilters,
        handleSearchKey,
    } = listState;

    return (
        <div className="flex items-center gap-2 flex-wrap">
            <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKey}
                placeholder="Search by ref no, medicine, lot, branch, requester…"
                className="flex-1 min-w-[200px] text-sm border border-gray-300
                    rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500
                    focus:outline-none"
            />

            <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-sm border border-gray-300 rounded-lg px-3 py-2
                    focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
                <option value="all">All status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
            </select>

            <button
                type="button"
                onClick={applyFilters}
                className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white
                    hover:bg-blue-700 transition"
            >
                Search
            </button>

            {(search || statusFilter !== "all") && (
                <button
                    type="button"
                    onClick={clearFilters}
                    className="text-sm px-3 py-2 rounded-lg border border-gray-300
                        text-gray-500 hover:bg-gray-50 transition"
                >
                    Clear
                </button>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────────────────────────────────
function EmptyState({ message }) {
    return (
        <div
            className="flex flex-col items-center justify-center py-20
            text-gray-400 gap-3 rounded-xl bg-white"
        >
            <svg
                className="w-12 h-12"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
            </svg>
            <p className="text-sm">{message}</p>
        </div>
    );
}
