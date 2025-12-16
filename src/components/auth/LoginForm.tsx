'use client';

import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { AuthFormWrapper } from "@/components/auth/AuthFormWrapper";
import { AuthHeading } from "@/components/auth/AuthHeading";
import { SocialButtons } from "@/components/auth/SocialButtons";
import { TextField } from "@/components/auth/TextField";
import { loginUser } from "@/lib/api/auth";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

type LoginErrors = {
  email?: string;
  password?: string;
  form?: string;
};

export function LoginForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<LoginErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [socialLoading, setSocialLoading] = useState<"google" | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: LoginErrors = {};

    if (!emailRegex.test(email.trim())) {
      nextErrors.email = "Enter a valid email";
    }

    if (!password.trim()) {
      nextErrors.password = "Password is required";
    }

    setErrors(nextErrors);
    setStatusMessage(null);

    if (Object.keys(nextErrors).length) return;

    try {
      setIsSubmitting(true);
      const result = await loginUser({
        email: email.trim(),
        password: password.trim(),
      });
      console.info("login success", result);
      setErrors({});
      setStatusMessage("You are in. Redirecting to your dashboard...");
      setTimeout(() => {
        navigate("/dashboard");
      }, 600);
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error
          ? error.message
          : "Unable to log you in right now. Please retry.";
      setErrors({ form: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleClick = async () => {
    setSocialLoading("google");
    await new Promise((resolve) => setTimeout(resolve, 900));
    console.log("Social auth via google");
    setSocialLoading(null);
  };

  return (
    <AuthFormWrapper className="space-y-8">
      <AuthHeading
        eyebrow="Member access"
        title="Welcome Back"
        subtitle="Log in to Ziv Cocktails Business"
      />
      <form onSubmit={handleSubmit} className="space-y-5">
        <TextField
          label="Email"
          placeholder="Enter your email"
          name="login-email"
          value={email}
          onChange={setEmail}
          type="email"
          error={errors.email}
          autoComplete="email"
        />
        <div className="space-y-2">
          <TextField
            label="Password"
            placeholder="Enter your password"
            name="login-password"
            value={password}
            onChange={setPassword}
            type="password"
            error={errors.password}
            autoComplete="current-password"
          />
          <div className="flex justify-end">
            <Link
              to="/auth/login"
              className="text-[12px] font-semibold text-[var(--auth-link)]"
            >
              Forgot password?
            </Link>
          </div>
        </div>
        <button
          type="submit"
          className="flex h-11 w-full items-center justify-center rounded-[10px] border border-[#3a5b22] bg-[#3a5b22] text-[13px] font-bold uppercase tracking-wide text-white transition hover:bg-[#31501d]"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Signing you in..." : "Sign In"}
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
      />
      <p className="text-center text-[13px] text-[var(--auth-text-muted)]">
        Don&apos;t have an account?{" "}
        <Link to="/auth/register" className="font-semibold text-[var(--auth-link)]">
          Sign Up
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
