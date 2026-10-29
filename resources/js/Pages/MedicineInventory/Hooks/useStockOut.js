import { useMemo, useRef, useState } from "react";
import { useForm } from "@inertiajs/react";
import { UNIT_TYPES } from "@/lib/units";
import { newIdempotencyKey } from "@/lib/idempotency";
import useBranchProducts, { resolveDefaultBranchId } from "./useBranchProducts";
import useBranchSwitch from "./useBranchSwitch";
import useStockOutBasket from "./useStockOutBasket";
import useStockOutFeedback from "./useStockOutFeedback";
import {
    TRANSACTION_SUBTYPES,
    validateStockOutHeader,
} from "../lib/stockOutValidation";

const emptyForm = (branchId) => ({
    // Generated when the modal opens and reused for every retry of this
    // submission, so a double click or resend can't record it twice.
    idempotency_key: newIdempotencyKey(),
    transaction_subtype: "",
    branch_id: branchId ? String(branchId) : "",
    patient_reference: "",
    issued_by: "",
    remarks: "",
    delivered_to: "",
    delivered_to_tin: "",
    delivered_to_address: "",
    items: [],
});

const RELOAD_PROPS = ["stockOuts", "medicines", "products", "movementLogs", "flash"];

export default function useStockOut({
    branchId,
    canAssignBranch = false,
    branches = [],
}) {
    const defaultBranchId = resolveDefaultBranchId(
        branchId,
        branches,
        canAssignBranch,
    );

    const [open, setOpen] = useState(false);
    const formRef = useRef(null);

    const { data, setData, post, errors, processing, reset, clearErrors } =
        useForm(emptyForm(defaultBranchId));

    // Medicines and lots always come from the source branch selected on the
    // form — for staff that is their own branch, for admins whichever they pick.
    const {
        products,
        loading: productsLoading,
        error: productsError,
        reload: reloadProducts,
    } = useBranchProducts({ open, branchId: data.branch_id });

    const productMap = useMemo(
        () =>
            Object.fromEntries(
                (products ?? []).map((product) => [String(product.id), product]),
            ),
        [products],
    );

    const basket = useStockOutBasket({
        items: data.items,
        setData,
        productMap,
        productsReady: !productsLoading && !productsError && Boolean(data.branch_id),
        errors,
        clearErrors,
    });

    const headerErrors = validateStockOutHeader(data, {
        subtype: data.transaction_subtype,
    });

    const feedback = useStockOutFeedback({
        formRef,
        serverErrors: errors,
        headerErrors,
        itemErrors: basket.itemErrors,
        itemCount: data.items.length,
    });

    /** setData + drop the stale server error for that field. */
    const setField = (field, value) => {
        setData(field, value);

        if (errors[field]) {
            clearErrors(field);
        }
    };

    // Switching branch clears the basket and draft in one step so lots
    // picked from the previous branch can never be posted to the new one.
    const applyBranchChange = (value) => {
        setData((current) => ({ ...current, branch_id: value, items: [] }));
        basket.resetDraft();
        clearErrors();
    };

    const {
        pendingBranchId,
        requestBranchChange: handleBranchChange,
        confirmBranchChange,
        cancelBranchChange,
        resetBranchSwitch,
    } = useBranchSwitch({
        currentBranchId: data.branch_id,
        itemCount: data.items.length,
        applyChange: applyBranchChange,
    });

    const openModal = () => {
        clearErrors();
        basket.resetDraft();
        resetBranchSwitch();
        feedback.resetFeedback();
        setData(emptyForm(defaultBranchId));
        setOpen(true);
    };

    const closeModal = () => {
        if (processing) {
            return;
        }

        setOpen(false);
        basket.resetDraft();
        resetBranchSwitch();
        feedback.resetFeedback();
        reset();
        clearErrors();
    };

    const handleSubmit = (event) => {
        event.preventDefault();

        if (processing || !feedback.beforeSubmit()) {
            return;
        }

        post(route("stock-out.store"), {
            preserveScroll: true,
            // "flash" must be reloaded too, or the success/error message
            // from the server is dropped and the submit looks like it did
            // nothing.
            only: RELOAD_PROPS,
            // A refused save (flash.error) also redirects back. Keep the
            // modal and basket open then so the user can retry with the
            // same idempotency key instead of losing everything.
            onSuccess: (page) => {
                if (feedback.handleServerFlash(page)) {
                    return;
                }

                setOpen(false);
                basket.resetDraft();
                resetBranchSwitch();
                feedback.resetFeedback();
                reset();
                clearErrors();
            },
            onError: (serverErrors) => {
                feedback.handleValidationErrors(serverErrors);

                // A lot may have changed since the list was loaded (another
                // user took stock); refresh so availability is current.
                if (Object.keys(serverErrors ?? {}).some((key) => key.startsWith("items."))) {
                    reloadProducts();
                }
            },
        });
    };

    return {
        TRANSACTION_SUBTYPES,
        UNIT_TYPES,
        open,
        openModal,
        closeModal,
        formRef,
        data,
        setData,
        setField,
        ...basket,
        productMap,
        products,
        productsLoading,
        productsError,
        reloadProducts,
        canAssignBranch,
        branches,
        handleBranchChange,
        pendingBranchId,
        confirmBranchChange,
        cancelBranchChange,
        errors: feedback.fieldErrors,
        generalErrors: feedback.generalErrors,
        serverError: feedback.serverError,
        dismissServerError: feedback.dismissServerError,
        attempted: feedback.attempted,
        problemCount: feedback.problemCount,
        processing,
        handleSubmit,
        clearErrors,
    };
}
