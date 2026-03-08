import { useForm } from "react-hook-form"
import { useSearchParams, useNavigate } from "react-router-dom"
import { useMutation } from "@tanstack/react-query"

type FormData = {
  newPassword: string
}

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get("token")

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>()

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await fetch("http://localhost:5000/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          newPassword: data.newPassword,
        }),
      })

      if (!res.ok) throw new Error("Failed")

      return res.json()
    },
    onSuccess: () => {
      setTimeout(() => navigate("/login"), 2000)
    },
  })

  const onSubmit = (data: FormData) => {
    mutation.mutate(data)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-6">

      <div className="bg-white shadow-2xl rounded-2xl p-10 w-full max-w-md">

        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
          Reset Password 🔑
        </h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

          <div>
            <input
              type="password"
              placeholder="Enter new password"
              {...register("newPassword", { required: "Password required" })}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {errors.newPassword && (
              <p className="text-sm text-red-500 mt-1">
                {errors.newPassword.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full py-3 rounded-full text-white font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-90 transition shadow-lg disabled:opacity-50"
          >
            {mutation.isPending ? "Resetting..." : "Reset Password"}
          </button>

          {mutation.isSuccess && (
            <p className="text-green-600 text-center">
              Password reset successful! Redirecting...
            </p>
          )}

        </form>

      </div>
    </div>
  )
}