import Button from "@/components/ui/button";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card } from "react-daisyui";
import { useForm } from "react-hook-form";
import { loginSchema } from "./schema";
import { InputField } from "@/components/ui/input";
import { useLogin, useOIDCStatus } from "./hooks";
import { API_URL } from "@/lib/api";
import { LogIn } from "lucide-react";

export default function LoginPage() {
  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { 
      username: "", 
      password: "",
    },
  });
  const login = useLogin();
  const oidc = useOIDCStatus();

  const ssoError = (() => {
    const raw = new URLSearchParams(window.location.search).get("error");
    if (!raw) return null;
    try {
      return atob(raw.replace(/-/g, "+").replace(/_/g, "/"));
    } catch {
      return raw;
    }
  })();

  return (
    <form onSubmit={form.handleSubmit((v) => login.mutate(v))}>
      <Card className="w-full max-w-md" bordered>
        <Card.Body>
          <Card.Title tag="h2">Login</Card.Title>
          <p className="text-base-content/60 mb-4">
            Enter your credentials to access the console
          </p>

          {ssoError && (
            <div className="mb-4 rounded-gw-sm border border-error/40 bg-error/5 px-3 py-2 text-sm text-error">
              {ssoError}
            </div>
          )}

          <div className="space-y-4">
            <InputField
              form={form}
              name="username"
              title="Username or Access Key ID"
              placeholder="Enter username or Access Key ID"
            />

            <InputField
              form={form}
              name="password"
              title="Password or Secret Access Key"
              type="password"
              placeholder="Enter password or Secret Access Key"
            />

            <div className="text-xs text-base-content/60">
              <p>You can login with:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Admin username and password</li>
                <li>Access Key ID and Secret Access Key</li>
              </ul>
            </div>
          </div>

          <Card.Actions className="mt-4">
            <Button
              type="submit"
              color="primary"
              className="w-full md:w-auto min-w-[100px]"
              loading={login.isPending}
            >
              Login
            </Button>
          </Card.Actions>

          {oidc.data?.enabled && (
            <div className="mt-4 pt-4 border-t border-hairline">
              <a
                href={API_URL + "/auth/oidc/login"}
                className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-gw-sm border border-hairline bg-base-200 hover:bg-base-300 text-sm font-medium transition-colors"
              >
                <LogIn size={16} />
                Sign in with SSO
              </a>
            </div>
          )}
        </Card.Body>
      </Card>
    </form>
  );
}
