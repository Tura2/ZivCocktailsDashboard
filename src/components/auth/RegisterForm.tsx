'use client';

import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { AuthFormWrapper } from "@/components/auth/AuthFormWrapper";
import { AuthHeading } from "@/components/auth/AuthHeading";
import { CheckboxWithLabel } from "@/components/auth/CheckboxWithLabel";
import { SocialButtons } from "@/components/auth/SocialButtons";
import { TextField } from "@/components/auth/TextField";
import { registerUser } from "@/lib/api/auth";

type FieldErrors = {
  name?: string;
  email?: string;
  password?: string;
  terms?: string;
  form?: string;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

export function RegisterForm() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | null>(null);

  const handleGoogleClick = async () => {
    setSocialLoading("google");
    await new Promise((resolve) => setTimeout(resolve, 900));
    console.log("Social signup via google");
    setSocialLoading(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: FieldErrors = {};

    if (!name.trim()) {
      nextErrors.name = "Name is required";
    }

    if (!emailRegex.test(email.trim())) {
      nextErrors.email = "Enter a valid email";
    }

    if (password.trim().length < 8) {
      nextErrors.password = "Password must be at least 8 characters";
    }

    if (!acceptedTerms) {
      nextErrors.terms = "Please agree to continue";
    }

    setErrors(nextErrors);
    setStatusMessage(null);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    try {
      setIsSubmitting(true);
      const result = await registerUser({
        name: name.trim(),
        email: email.trim(),
        password: password.trim(),
      });
      console.info("register success", result);
      setErrors({});
      setStatusMessage("Account created! Redirecting you to the dashboard...");
      setTimeout(() => {
        navigate("/dashboard");
      }, 900);
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error
          ? error.message
          : "We could not complete your signup. Please retry.";
      setErrors({ form: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthFormWrapper className="space-y-8">
      <AuthHeading
        eyebrow="Private access"
        title="Get Started Now"
        subtitle="Create your Ziv Cocktails Business account"
      />
      <form onSubmit={handleSubmit} className="space-y-5">
        <TextField
          label="Name"
          placeholder="Enter your name"
          name="name"
          value={name}
          onChange={setName}
          error={errors.name}
          autoComplete="name"
        />
        <TextField
          label="Email"
          placeholder="Enter your email"
          name="email"
          value={email}
          onChange={setEmail}
          type="email"
          error={errors.email}
          autoComplete="email"
        />
        <div className="space-y-3">
          <TextField
            label="Password"
            placeholder="Create a password"
            name="password"
            value={password}
            onChange={setPassword}
            type="password"
            error={errors.password}
            autoComplete="new-password"
          />
        </div>
        <CheckboxWithLabel
          checked={acceptedTerms}
          onChange={setAcceptedTerms}
          label="I agree to the"
          highlightText="terms & policy"
          highlightHref="/terms"
          error={errors.terms}
        />
        <button
          type="submit"
          className="flex h-11 w-full items-center justify-center rounded-[10px] border border-[#3a5b22] bg-[#3a5b22] text-[13px] font-bold uppercase tracking-wide text-white transition hover:bg-[#31501d]"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Signing you up..." : "Signup"}
        </button>
        {errors.form ? (
          <p className="text-[12px] text-[#d94841]">{errors.form}</p>
        ) : null}
        {statusMessage ? (
          <p className="text-[12px] text-[#3a5b22]">{statusMessage}</p>
        ) : null}
      </form>
      <Divider label="Or" />
      <SocialButtons
        loadingTarget={socialLoading}
        onGoogle={handleGoogleClick}
        showApple={false}
        googleLabel="Sign up with Google"
      />
      <p className="text-center text-[13px] text-[var(--auth-text-muted)]">
        Have an account?{" "}
        <Link to="/auth/login" className="font-semibold text-[var(--auth-link)]">
          Sign In
        </Link>
      </p>
    </AuthFormWrapper>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4">
      <span className="h-px flex-1 bg-[var(--auth-stroke)]" />
      <span className="text-[12px] font-semibold text-[var(--auth-text-strong)]">
        {label}
      </span>
      <span className="h-px flex-1 bg-[var(--auth-stroke)]" />
    </div>
  );
}
