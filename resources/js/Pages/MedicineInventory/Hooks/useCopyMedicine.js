import { useEffect, useState } from "react";
import { useForm } from "@inertiajs/react";
import { fetchMedicineBranchPresence } from "../lib/inventoryMedicinesApi";

export default function useCopyMedicine(medicine) {
    const [open, setOpen] = useState(false);
    const [existingBranchIds, setExistingBranchIds] = useState(
        () => new Set(),
    );
    const [loadingPresence, setLoadingPresence] = useState(false);

    const { data, setData, post, errors, processing, reset, clearErrors } =
        useForm({
            branch_ids: [],
        });

    useEffect(() => {
        if (!open || !medicine) {
            return;
        }

        let cancelled = false;

        // Until the lookup returns, at least the medicine's own branch is known.
        setExistingBranchIds(new Set([String(medicine.branch_id)]));
        setLoadingPresence(true);

        fetchMedicineBranchPresence(medicine.id)
            .then((response) => {
                if (!cancelled) {
                    setExistingBranchIds(
                        new Set([
                            String(medicine.branch_id),
                            ...(response.branch_ids ?? []).map(String),
                        ]),
                    );
                }
            })
            .catch(() => {})
            .finally(() => {
                if (!cancelled) {
                    setLoadingPresence(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [open, medicine]);

    const toggleBranch = (id, checked) => {
        const value = String(id);

        setData(
            "branch_ids",
            checked
                ? [...new Set([...data.branch_ids, value])]
                : data.branch_ids.filter((branch) => branch !== value),
        );
    };

    const openModal = () => setOpen(true);
    const closeModal = () => {
        setOpen(false);
        reset();
        clearErrors();
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        post(route("medicine-inventory.copy", medicine.id), {
            onSuccess: () => {
                closeModal();
            },
            preserveScroll: true,
        });
    };

    return {
        open,
        openModal,
        closeModal,
        data,
        errors,
        processing,
        handleSubmit,
        existingBranchIds,
        loadingPresence,
        toggleBranch,
    };
}
