import { Card, CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import CartTable from "./CartTable";
import CheckoutDialog from "./CheckoutDialog";
import CustomerSearchSelect from "./CustomerSearchSelect";
import NewCustomerModal from "./NewCustomerModal";
import { formatCurrency } from "../lib/pricing";

export default function CartPanel({
    cartId,
    cartItems,
    discountPercent,
    setDiscountPercent,
    togglePercentDiscount,
    discountAmount,
    selectedCustomer,
    onSelectCustomer,
    onClearCustomer,
    grossTotal,
    netTotal,
    syncing,
    branchId,
    branchName,
    branches,
    roleId,
    onRemove,
    onUpdateQuantity,
    onSetQuantity,
    onUpdateUnitType,
    onCheckoutSuccess,
}) {
    const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    const showBranch = roleId === 2;

    return (
        <Card className="flex h-full w-full max-w-full flex-col overflow-hidden">
            <CardHeader className="border-b pb-4">
                <div className="flex items-center justify-between">
                    <CardTitle>Cart</CardTitle>
                    <span className="text-sm text-muted-foreground">
                        {itemCount} {itemCount === 1 ? "item" : "items"}
                    </span>
                </div>
            </CardHeader>

            <CardContent className="flex min-w-0 flex-1 flex-col gap-4 overflow-hidden pt-4">
                <CartTable
                    cartItems={cartItems}
                    syncing={syncing}
                    onRemove={onRemove}
                    onUpdateQuantity={onUpdateQuantity}
                    onSetQuantity={onSetQuantity}
                    onUpdateUnitType={onUpdateUnitType}
                />

                {cartItems.length > 0 && (
                    <>
                        <div className="space-y-2">
                            <Label>Customer</Label>
                            <div className="flex items-center gap-2">
                                <CustomerSearchSelect
                                    value={selectedCustomer}
                                    onChange={onSelectCustomer}
                                    onClear={onClearCustomer}
                                    showBranch={showBranch}
                                    disabled={syncing}
                                />
                                <NewCustomerModal
                                    branchId={branchId}
                                    branchName={branchName}
                                    branches={branches}
                                    roleId={roleId}
                                    onCustomerCreated={onSelectCustomer}
                                    disabled={syncing}
                                />
                            </div>
                        </div>

                        <div className="mt-auto space-y-3 rounded-lg bg-muted/50 p-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                                Gross Total
                            </span>
                            <span className="font-semibold">
                                {formatCurrency(grossTotal)}
                            </span>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                            <Label htmlFor="discount" className="shrink-0">
                                Discount
                            </Label>
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <Input
                                        id="discount"
                                        type="number"
                                        min="0"
                                        max={100}
                                        step="0.01"
                                        value={discountPercent}
                                        onChange={(event) =>
                                            setDiscountPercent(
                                                event.target.value,
                                            )
                                        }
                                        className="max-w-[100px] pr-6 text-right"
                                    />
                                    <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-sm text-muted-foreground">
                                        %
                                    </span>
                                </div>
                                <span className="w-20 shrink-0 text-right text-sm text-muted-foreground">
                                    -{formatCurrency(discountAmount)}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                type="button"
                                variant={
                                    discountPercent === 20
                                        ? "default"
                                        : "outline"
                                }
                                size="sm"
                                disabled={syncing || grossTotal <= 0}
                                onClick={() => togglePercentDiscount(20)}
                            >
                                PWD / Senior 20%
                            </Button>
                            <Button
                                type="button"
                                variant={
                                    discountPercent === 10
                                        ? "default"
                                        : "outline"
                                }
                                size="sm"
                                disabled={syncing || grossTotal <= 0}
                                onClick={() => togglePercentDiscount(10)}
                            >
                                Single Mother 10%
                            </Button>
                        </div>

                        <div className="flex items-center justify-between border-t pt-3">
                            <span className="text-base font-semibold">
                                Net Total
                            </span>
                            <span className="text-lg font-bold text-green-700">
                                {formatCurrency(netTotal)}
                            </span>
                        </div>

                        <CheckoutDialog
                            cartId={cartId}
                            cartItems={cartItems}
                            discountPercent={discountPercent}
                            discountAmount={discountAmount}
                            grossTotal={grossTotal}
                            netTotal={netTotal}
                            selectedCustomer={selectedCustomer}
                            onCheckoutSuccess={onCheckoutSuccess}
                        >
                            <Button className="w-full" size="lg" disabled={syncing}>
                                Checkout {formatCurrency(netTotal)}
                            </Button>
                        </CheckoutDialog>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
