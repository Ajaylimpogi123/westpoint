import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "@inertiajs/react";
import axios from "axios";
import { UNIT_TYPES } from "@/lib/units";
import { fetchBranchProducts } from "../lib/inventoryMedicinesApi";
import useStockOutBasket from "./useStockOutBasket";
import useStockOutFeedback from "./useStockOutFeedback";
import {
    DELIVERY_TO_CUSTOMER,
    validateStockOutHeader,
} from "../lib/stockOutValidation";

const emptyForm = () => ({
    patient_reference: "",
    issued_by: "",
    remarks: "",
    delivered_to: "",
    delivered_to_tin: "",
    delivered_to_address: "",
    items: [],
});

const RELOAD_PROPS = ["stockOuts", "medicines", "products", "movementLogs", "flash"];

export default function useStockOutEdit({ stockOutId, open }) {
    const [products, setProducts] = useState([]);
    const [productsLoading, setProductsLoading] = useState(false);
    const [productsError, setProductsError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState(null);
    const [transactionSubtype, setTransactionSubtype] = useState(null);
    const [branchName, setBranchName] = useState(null);
    const formRef = useRef(null);

    const { data, setData, put, errors, processing, reset, clearErrors } =
        useForm(emptyForm());

    // Load the stock-out plus its branch's current products/lots whenever
    // the modal opens. Live lot quantities come from fetchBranchProducts,
    // the same source the create modal uses — nothing has been deducted
    // yet for an editable stock-out, so those quantities are already
    // accurate without any "reserved" adjustment.
    useEffect(() => {
        if (!open || !stockOutId) {
            return;
        }

        let cancelled = false;

        const load = async () => {
            setLoading(true);
            setLoadError(null);
            setProductsError(null);
            clearErrors();

            try {
                const response = await axios.get(
                    route("stock-out.edit", stockOutId),
                );
                const { stock_out, items } = response.data;

                if (cancelled) return;

                setTransactionSubtype(stock_out.transaction_subtype);
                setBranchName(stock_out.branch?.branch_name ?? null);
                setData({
                    patient_reference: stock_out.patient_reference ?? "",
                    issued_by: stock_out.issued_by ?? "",
                    remarks: stock_out.remarks ?? "",
                    delivered_to: stock_out.delivered_to ?? "",
                    delivered_to_tin: stock_out.delivered_to_tin ?? "",
                    delivered_to_address: stock_out.delivered_to_address ?? "",
                    items: items.map((item) => ({
                        pd_id: String(item.pd_id),
                        products_qty_id: String(item.products_qty_id),
                        lot_number: item.lot_number,
                        quantity_deducted: item.quantity_deducted,
                        unit_type: item.unit_type,
                        // May be null on legacy Box rows; the basket row
                        // asks for it before the edit can be saved.
                        pieces_per_box: item.pieces_per_box ?? null,
                        pieces_preview: item.pieces_deducted,
                    })),
                });

                setProductsLoading(true);
                try {
                    const branchProducts = await fetchBranchProducts(
                        stock_out.branch_id,
                    );
                    if (!cancelled) {
                        setProducts(branchProducts.products ?? []);
                    }
                } catch {
                    if (!cancelled) {
                        setProductsError(
                            "Could not load medicines for this branch.",
                        );
                    }
                } finally {
                    if (!cancelled) setProductsLoading(false);
                }
            } catch (error) {
                if (!cancelled) {
                    setLoadError(
                        error?.response?.status === 403
                            ? "This stock-out can no longer be edited."
                            : "Failed to load this stock-out.",
                    );
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, stockOutId]);

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
        productsReady: !loading && !productsLoading && !productsError,
        errors,
        clearErrors,
    });

    // Only pending deliveries are editable, so the recipient is always
    // required here (contract: delivered_to required on update).
    const headerErrors = validateStockOutHeader(data, {
        subtype: DELIVERY_TO_CUSTOMER,
        checkSubtype: false,
        checkBranch: false,
    });

    const feedback = useStockOutFeedback({
        formRef,
        serverErrors: errors,
        headerErrors,
        itemErrors: basket.itemErrors,
        itemCount: data.items.length,
    });

    const setField = (field, value) => {
        setData(field, value);

        if (errors[field]) {
            clearErrors(field);
        }
    };

    const resetLocal = () => {
        basket.resetDraft();
        feedback.resetFeedback();
        setProducts([]);
        setProductsError(null);
        setLoadError(null);
        reset();
        clearErrors();
    };

    const handleSubmit = (event, { onSuccess } = {}) => {
        event.preventDefault();

        if (processing || loading || !feedback.beforeSubmit()) {
            return;
        }

        put(route("stock-out.update", stockOutId), {
            preserveScroll: true,
            // Include "flash" or the server's message is dropped.
            only: RELOAD_PROPS,
            onSuccess: (page) => {
                // A refused update redirects back with flash.error; keep the
                // edit modal open with the user's changes.
                if (feedback.handleServerFlash(page)) {
                    return;
                }

                resetLocal();
                onSuccess?.();
            },
            onError: feedback.handleValidationErrors,
        });
    };

    return {
        UNIT_TYPES,
        loading,
        loadError,
        transactionSubtype,
        branchName,
        formRef,
        data,
        setData,
        setField,
        ...basket,
        productMap,
        products,
        productsLoading,
        productsError,
        errors: feedback.fieldErrors,
        generalErrors: feedback.generalErrors,
        serverError: feedback.serverError,
        dismissServerError: feedback.dismissServerError,
        attempted: feedback.attempted,
        problemCount: feedback.problemCount,
        processing,
        handleSubmit,
        resetLocal,
    };
}
