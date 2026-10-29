import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

/**
 * Asks before switching the branch of a transaction whose basket already
 * has items. Confirming clears the basket, because those items (and their
 * lots) belong to the previously selected branch.
 */
export default function BranchChangeConfirmDialog({
    pendingBranchId,
    branches = [],
    itemCount = 0,
    onConfirm,
    onCancel,
}) {
    const open = pendingBranchId !== null && pendingBranchId !== undefined;
    const targetName =
        branches.find((branch) => String(branch.id) === String(pendingBranchId))
            ?.branch_name ?? "the selected branch";

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) {
                    onCancel();
                }
            }}
        >
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Change branch?</DialogTitle>
                    <DialogDescription>
                        The basket has {itemCount}{" "}
                        {itemCount === 1 ? "item" : "items"} from the current
                        branch. Switching to {targetName} will remove{" "}
                        {itemCount === 1 ? "it" : "them"} from the basket.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onCancel}>
                        Keep current branch
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={onConfirm}
                    >
                        Clear basket and switch
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
