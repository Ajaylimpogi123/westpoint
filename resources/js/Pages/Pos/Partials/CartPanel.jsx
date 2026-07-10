import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CartTable from "./CartTable";
import CheckoutDialog from "./CheckoutDialog";
import CustomerSearchSelect from "./CustomerSearchSelect";
import NewCustomerModal from "./NewCustomerModal";
import { formatCurrency } from "../lib/pricing";

export default function CartPanel({
    cartId,
    cartItems,
    discount,
    setDiscount,
    discountPreset,
    togglePercentDiscount,
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
                            <Input
                                id="discount"
                                type="number"
                                min="0"
                                max={grossTotal}
                                step="0.01"
                                value={discount}
                                onChange={(event) =>
                                    setDiscount(
                                        Math.min(
                                            Number(event.target.value) || 0,
                                            grossTotal,
                                        ),
                                    )
                                }
                                className="max-w-[140px] text-right"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                type="button"
                                variant={
                                    discountPreset === 20 ? "default" : "outline"
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
                                    discountPreset === 10 ? "default" : "outline"
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
                            discount={discount}
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
