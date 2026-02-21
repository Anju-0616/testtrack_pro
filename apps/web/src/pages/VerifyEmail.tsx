import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [message, setMessage] = useState("Verifying your email...");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      // User just registered
      setMessage("Please verify your email to login.");
      return;
    }

    // Token present → verify
    setLoading(true);
    setMessage("Verifying your email...");


    axios
      .get(`http://localhost:5000/auth/verify-email?token=${token}`)
      .then(() => {
        setMessage("Email verified successfully! Redirecting to login...");
        setLoading(false);

        setTimeout(() => {
          navigate("/login");
        }, 2000);
      })
      .catch(() => {
        setMessage("Verification link is invalid or expired.");
        setLoading(false);
      });
  }, [token, navigate]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <h2 className="text-xl font-semibold">
          {loading ? "Please wait..." : message}
        </h2>
      </div>
    </div>
  );
}