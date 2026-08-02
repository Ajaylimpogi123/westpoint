import { Banknote, Receipt, TicketPercent, Landmark } from "lucide-react";

const formatCurrency = (value) =>
    `₱${Number(value ?? 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

function StatCard({ label, value, icon: Icon, accent }) {
    return (
        <div className="rounded-2xl border border-white bg-white backdrop-blur-2xl p-5">
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-widest text-black">
                    {label}
                </span>
                <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${accent}1A` }}
                >
                    <Icon
                        className="h-4 w-4"
                        style={{ color: accent }}
                        strokeWidth={1.75}
                    />
                </div>
            </div>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-black">
                {value}
            </p>
        </div>
    );
}

export default function SalesSummaryCards({ totals }) {
    const {
        transaction_count = 0,
        gross_total = 0,
        discount_total = 0,
        net_total = 0,
    } = totals ?? {};

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
                label="Gross Sales"
                value={formatCurrency(gross_total)}
                icon={Banknote}
                accent="#4F9CF9"
            />
            <StatCard
                label="Discounts"
                value={formatCurrency(discount_total)}
                icon={TicketPercent}
                accent="#FFB020"
            />
            <StatCard
                label="Net Sales"
                value={formatCurrency(net_total)}
                icon={Landmark}
                accent="#3DDC97"
            />
            <StatCard
                label="Transactions"
                value={Number(transaction_count).toLocaleString()}
                icon={Receipt}
                accent="#7C6CFF"
            />
        </div>
    );
}
