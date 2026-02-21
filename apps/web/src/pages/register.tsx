import { useForm } from "react-hook-form";
import axios from "axios";
import { useNavigate } from "react-router-dom";


type RegisterFormData = {
  email: string;
  password: string;
  role: "TESTER" | "DEVELOPER";
};

export default function Register() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    defaultValues: {
      role: "TESTER", // ✅ default role
    },
  });

  const navigate = useNavigate();
  const onSubmit = async (data: RegisterFormData) => {
  try {
    await axios.post(
      "http://localhost:5000/auth/register",
      data
    );

    // Redirect to verify page
    navigate("/verify-email");
    

  } catch (error: any) {
    alert(error.response?.data?.message || "Registration failed");
  }
};



  return (
  <div className="min-h-screen flex items-center justify-center bg-gray-100">
    <div className="bg-white shadow-lg rounded-xl p-8 w-full max-w-md">

      <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">
        Create Your Account
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

        {/* Email */}
        <div>
          <input
            type="email"
            placeholder="Email"
            {...register("email", { required: "Email is required" })}
            className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.email && (
            <p className="text-sm text-red-500 mt-1">
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password */}
        <div>
          <input
            type="password"
            placeholder="Password"
            {...register("password", { required: "Password is required" })}
            className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errors.password && (
            <p className="text-sm text-red-500 mt-1">
              {errors.password.message}
            </p>
          )}
        </div>

        {/* Role */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Register As
          </label>
          <select
            {...register("role")}
            className="w-full border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="TESTER">Tester</option>
            <option value="DEVELOPER">Developer</option>
          </select>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition duration-200 disabled:opacity-50"
        >
          {isSubmitting ? "Creating Account..." : "Register"}
        </button>

      </form>

    </div>
  </div>
);

}
