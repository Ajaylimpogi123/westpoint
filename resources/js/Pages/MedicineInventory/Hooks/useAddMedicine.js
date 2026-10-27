import { useEffect, useMemo, useState } from "react";
import { useForm } from "@inertiajs/react";
import {
    fetchMedicineCatalog,
    fetchSimilarMedicines,
} from "../lib/inventoryMedicinesApi";

const SUGGESTION_DELAY_MS = 250;

const normalize = (value) =>
    String(value ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

// Mirrors MedicineProduct::scopeSameIdentity on the server.
export const medicineIdentityKey = (medicine) =>
    ["med_name", "dose", "form", "brand_name"]
        .map((field) => normalize(medicine?.[field]))
        .join("|");

export default function useAddMedicine({
    branchId = null,
    canAssignBranch = false,
    branches = [],
    preferredBranchId = null,
} = {}) {
    const [open, setOpen] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [pickedSuggestion, setPickedSuggestion] = useState(null);
    const [similarMedicines, setSimilarMedicines] = useState([]);

    // Admins default to the branch they're currently filtering by, so the new
    // medicine shows up in the list they're looking at.
    const defaultBranchIds = () => {
        if (!canAssignBranch) {
            return [];
        }

        const defaultId = preferredBranchId ?? branchId ?? branches[0]?.id;

        return defaultId ? [String(defaultId)] : [];
    };

    const {
        data,
        setData,
        post,
        errors,
        processing,
        reset,
        clearErrors,
        transform,
    } = useForm({
            branch_ids: defaultBranchIds(),
            med_name: "",
            dose: "",
            form: "",
            pack_size: 1,
            brand_name: "",
            is_generic: false,
            retail_price: "",
            stock_threshold: 10,
            wholesale_price: "",
            vat_status: "Non-VAT",
        });

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const query = data.med_name.trim();

        if (query.length < 2) {
            setSuggestions([]);
            return undefined;
        }

        const controller = new AbortController();
        const timer = setTimeout(() => {
            fetchMedicineCatalog(query, { signal: controller.signal })
                .then((response) => setSuggestions(response.medicines ?? []))
                .catch((error) => {
                    if (error.name !== "AbortError") {
                        setSuggestions([]);
                    }
                });
        }, SUGGESTION_DELAY_MS);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [open, data.med_name]);

    // The server asks for confirmation when the name sounds like an existing
    // medicine spelled differently; load those so the user can pick one.
    const needsNameConfirmation = Boolean(errors.confirm_new_name);

    useEffect(() => {
        if (!needsNameConfirmation) {
            setSimilarMedicines([]);
            return undefined;
        }

        let cancelled = false;

        fetchSimilarMedicines(data.med_name)
            .then((response) => {
                if (!cancelled) {
                    setSimilarMedicines(response.medicines ?? []);
                }
            })
            .catch(() => {});

        return () => {
            cancelled = true;
        };
    }, [needsNameConfirmation]);

    // The medicine already on file that the form currently describes, if any.
    const existingMatch = useMemo(() => {
        const key = medicineIdentityKey(data);

        return (
            [pickedSuggestion, ...suggestions].find(
                (medicine) => medicine && medicineIdentityKey(medicine) === key,
            ) ?? null
        );
    }, [data, pickedSuggestion, suggestions]);

    const existingBranchIds = useMemo(
        () =>
            new Set(
                (existingMatch?.branches ?? []).map((branch) =>
                    String(branch.id),
                ),
            ),
        [existingMatch],
    );

    // Drop branches that already carry the matched medicine.
    useEffect(() => {
        if (!existingBranchIds.size) {
            return;
        }

        const remaining = data.branch_ids.filter(
            (id) => !existingBranchIds.has(String(id)),
        );

        if (remaining.length !== data.branch_ids.length) {
            setData("branch_ids", remaining);
        }
    }, [existingBranchIds]);

    const handleNameChange = (value) => {
        setData("med_name", value);
        setShowSuggestions(true);
        clearErrors("confirm_new_name");
    };

    const pickSuggestion = (medicine) => {
        setPickedSuggestion(medicine);
        setShowSuggestions(false);
        clearErrors("med_name", "confirm_new_name");
        setData((current) => ({
            ...current,
            med_name: medicine.med_name ?? "",
            dose: medicine.dose ?? "",
            form: medicine.form ?? "",
            brand_name: medicine.brand_name ?? "",
            pack_size: medicine.pack_size ?? 1,
            is_generic: Boolean(medicine.is_generic),
            retail_price: medicine.retail_price ?? "",
            wholesale_price: medicine.wholesale_price ?? "",
            vat_status: medicine.vat_status ?? "Non-VAT",
            stock_threshold: medicine.stock_threshold ?? 10,
        }));
    };

    const toggleBranch = (id, checked) => {
        const value = String(id);

        setData(
            "branch_ids",
            checked
                ? [...new Set([...data.branch_ids, value])]
                : data.branch_ids.filter((branch) => branch !== value),
        );
    };

    const selectAllBranches = () => {
        setData(
            "branch_ids",
            branches
                .map((branch) => String(branch.id))
                .filter((id) => !existingBranchIds.has(id)),
        );
    };

    const openModal = () => {
        setData("branch_ids", defaultBranchIds());
        setOpen(true);
    };
    const closeModal = () => {
        setOpen(false);
        setSuggestions([]);
        setShowSuggestions(false);
        setPickedSuggestion(null);
        reset();
        clearErrors();
    };

    const submit = ({ confirmNewName = false } = {}) => {
        transform((form) =>
            confirmNewName ? { ...form, confirm_new_name: true } : form,
        );

        post(route("medicine-inventory.store"), {
            onSuccess: () => {
                closeModal();
            },
            preserveScroll: true,
        });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        submit();
    };

    const confirmNewName = () => submit({ confirmNewName: true });

    return {
        open,
        openModal,
        closeModal,
        data,
        setData,
        errors,
        processing,
        handleSubmit,
        canAssignBranch,
        branches,
        suggestions,
        showSuggestions: showSuggestions && suggestions.length > 0,
        hideSuggestions: () => setShowSuggestions(false),
        handleNameChange,
        pickSuggestion,
        existingMatch,
        existingBranchIds,
        toggleBranch,
        selectAllBranches,
        needsNameConfirmation,
        similarMedicines,
        confirmNewName,
    };
}
