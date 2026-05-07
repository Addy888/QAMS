import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import type { AxiosError } from "axios";
import Modal from "@/components/ui/Modal";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/navigation";
import { createUser, type CreateUserPayload } from "../api";

interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Role of the actor opening the dialog. Drives which roles are creatable. */
  actorRole: UserRole;
  /** Called after a successful creation — useful for refreshing lists. */
  onCreated?: (user: { id: string; username: string; role: UserRole }) => void;
}

type FormValues = {
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  role: Exclude<UserRole, "ADMIN">;
};

/**
 * Mirrors the server-side ROLE_CREATION_MATRIX so the UI only offers
 * roles the actor is actually allowed to create.
 */
const CREATABLE_ROLES: Record<UserRole, Array<Exclude<UserRole, "ADMIN">>> = {
  ADMIN: ["SUPERVISOR", "AGENT"],
  SUPERVISOR: ["AGENT"],
  AGENT: [],
};

const fieldClass = cn(
  "h-10 w-full rounded-md border border-border bg-bg-elevated px-3 text-sm text-fg",
  "placeholder:text-fg-subtle transition-colors",
  "focus-visible:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-ring/40"
);

const labelClass = "text-xs font-medium text-fg-muted";
const errorClass = "text-xs text-danger";

export function AddUserDialog({
  open,
  onOpenChange,
  actorRole,
  onCreated,
}: AddUserDialogProps) {
  const allowedRoles = useMemo(
    () => CREATABLE_ROLES[actorRole] ?? [],
    [actorRole]
  );

  const defaultRole = allowedRoles[0];

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setError,
  } = useForm<FormValues>({
    defaultValues: {
      firstName: "",
      lastName: "",
      username: "",
      password: "",
      role: defaultRole,
    },
  });

  // Reset whenever the dialog re-opens so old values don't leak across uses.
  useEffect(() => {
    if (open) {
      reset({
        firstName: "",
        lastName: "",
        username: "",
        password: "",
        role: defaultRole,
      });
    }
  }, [open, reset, defaultRole]);

  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = async (values: FormValues) => {
    const payload: CreateUserPayload = {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      username: values.username.trim(),
      password: values.password,
      role: values.role,
    };

    try {
      const created = await createUser(payload);
      toast.success(`${created.name} added as ${created.role.toLowerCase()}`);
      onOpenChange(false);
      onCreated?.({ id: created.id, username: created.username, role: created.role });
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string | string[] }>;
      const status = axiosErr.response?.status;
      const raw = axiosErr.response?.data?.message;
      const apiMessage = Array.isArray(raw) ? raw.join(", ") : raw;

      if (status === 409) {
        setError("username", {
          type: "server",
          message: apiMessage ?? "Username is already taken",
        });
        toast.error("Username already exists");
        return;
      }

      if (status === 403) {
        toast.error(apiMessage ?? "You can't create that role");
        return;
      }

      if (status === 400) {
        toast.error(apiMessage ?? "Please check the form for errors");
        return;
      }

      toast.error("Could not create user. Please try again.");
    }
  };

  const cancelBtn = (
    <button
      type="button"
      onClick={() => onOpenChange(false)}
      className="inline-flex h-9 items-center rounded-md border border-border bg-surface px-3 text-sm font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
    >
      Cancel
    </button>
  );

  const submitBtn = (
    <button
      type="submit"
      form="add-user-form"
      disabled={isSubmitting || allowedRoles.length === 0}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-fg",
        "shadow-elev-1 transition-opacity hover:opacity-90 disabled:opacity-60"
      )}
    >
      {isSubmitting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <UserPlus className="h-4 w-4" />
      )}
      {isSubmitting ? "Creating…" : "Create user"}
    </button>
  );

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Add user"
      description="Create a new workspace user. They'll be able to sign in immediately."
      size="lg"
      footer={
        <>
          {cancelBtn}
          {submitBtn}
        </>
      }
    >
      {allowedRoles.length === 0 ? (
        <p className="text-sm text-fg-muted">
          Your role doesn't have permission to create users.
        </p>
      ) : (
        <form
          id="add-user-form"
          onSubmit={handleSubmit(onSubmit)}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          noValidate
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="firstName" className={labelClass}>
              First name
            </label>
            <input
              id="firstName"
              autoComplete="given-name"
              placeholder="Aman"
              className={fieldClass}
              {...register("firstName", {
                required: "First name is required",
                maxLength: { value: 60, message: "Too long" },
              })}
            />
            {errors.firstName && (
              <p className={errorClass}>{errors.firstName.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="lastName" className={labelClass}>
              Last name
            </label>
            <input
              id="lastName"
              autoComplete="family-name"
              placeholder="Undre"
              className={fieldClass}
              {...register("lastName", {
                required: "Last name is required",
                maxLength: { value: 60, message: "Too long" },
              })}
            />
            {errors.lastName && (
              <p className={errorClass}>{errors.lastName.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="username" className={labelClass}>
              Username
            </label>
            <input
              id="username"
              autoComplete="off"
              placeholder="amanundre"
              className={fieldClass}
              {...register("username", {
                required: "Username is required",
                minLength: { value: 3, message: "At least 3 characters" },
                maxLength: { value: 60, message: "Too long" },
                pattern: {
                  value: /^[a-zA-Z0-9._-]+$/,
                  message: "Letters, numbers, dot, hyphen, underscore only",
                },
              })}
            />
            {errors.username && (
              <p className={errorClass}>{errors.username.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="password" className={labelClass}>
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                className={cn(fieldClass, "pr-16")}
                {...register("password", {
                  required: "Password is required",
                  minLength: { value: 8, message: "At least 8 characters" },
                  maxLength: { value: 100, message: "Too long" },
                })}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2 top-1/2 inline-flex h-7 -translate-y-1/2 items-center rounded px-2 text-xs font-medium text-fg-muted hover:bg-bg-muted hover:text-fg"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {errors.password && (
              <p className={errorClass}>{errors.password.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="role" className={labelClass}>
              Role
            </label>
            <select
              id="role"
              className={cn(fieldClass, "appearance-none pr-8")}
              {...register("role", { required: "Role is required" })}
            >
              {allowedRoles.map((role) => (
                <option key={role} value={role}>
                  {role.charAt(0) + role.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
            {errors.role && (
              <p className={errorClass}>{errors.role.message}</p>
            )}
          </div>
        </form>
      )}
    </Modal>
  );
}

export default AddUserDialog;
