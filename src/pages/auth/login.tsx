import Button from "@/components/ui/button";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card } from "react-daisyui";
import { useForm } from "react-hook-form";
import { loginSchema } from "./schema";
import { InputField } from "@/components/ui/input";
import { useLogin } from "./hooks";

export default function LoginPage() {
  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { 
      username: "", 
      password: "",
    },
  });
  const login = useLogin();

  return (
    <form onSubmit={form.handleSubmit((v) => login.mutate(v))}>
      <Card className="w-full max-w-md" bordered>
        <Card.Body>
          <Card.Title tag="h2">Login</Card.Title>
          <p className="text-base-content/60 mb-4">
            Enter your credentials to access the console
          </p>

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
        </Card.Body>
      </Card>
    </form>
  );
}
