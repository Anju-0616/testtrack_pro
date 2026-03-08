import { useForm } from "react-hook-form"
import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"

type FormData = {
  email: string
}

export default function ForgotPassword() {
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>()

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await fetch("http://localhost:5000/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!res.ok) throw new Error("Failed")

      return res.json()
    },
  })

  const onSubmit = (data: FormData) => {
    mutation.mutate(data)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-6">
      
      <div className="bg-white shadow-2xl rounded-2xl p-10 w-full max-w-md">

        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
          Forgot Password 🔐
        </h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

          <div>
            <input
              type="email"
              placeholder="Enter your email"
              {...register("email", { required: "Email is required" })}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {errors.email && (
              <p className="text-sm text-red-500 mt-1">
                {errors.email.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full py-3 rounded-full text-white font-semibold bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-90 transition shadow-lg disabled:opacity-50"
          >
            {mutation.isPending ? "Sending..." : "Send Reset Link"}
          </button>

          {mutation.isSuccess && (
            <p className="text-green-600 text-center">
              If the email exists, reset link has been sent.
            </p>
          )}

        </form>

        <p
          onClick={() => navigate("/login")}
          className="mt-6 text-center text-sm text-gray-600 cursor-pointer hover:underline"
        >
          Back to Login
        </p>

      </div>
    </div>
  )
}