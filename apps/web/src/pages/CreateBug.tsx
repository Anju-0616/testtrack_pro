import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation } from "@tanstack/react-query"

const bugSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(5),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  priority: z.enum(["P3_LOW", "P2_MEDIUM", "P1_URGENT"]),
  assignedToId: z.string(),
  testCaseId: z.string(),
})

type BugFormData = z.infer<typeof bugSchema>

export default function CreateBug() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BugFormData>({
    resolver: zodResolver(bugSchema),
  })

  const mutation = useMutation({
    mutationFn: async (data: BugFormData) => {
      const token = localStorage.getItem("token")

      const res = await fetch("http://localhost:5000/bugs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...data,
          assignedToId: parseInt(data.assignedToId),
          testCaseId: parseInt(data.testCaseId),
        }),
      })

      if (!res.ok) throw new Error("Failed to create bug")

      return res.json()
    },
    onSuccess: () => {
      alert("Bug created successfully")
    },
  })

  const onSubmit = (data: BugFormData) => {
    mutation.mutate(data)
  }

  return (
    <div style={{ padding: 30 }}>
      <h2>Create Bug</h2>

      <form onSubmit={handleSubmit(onSubmit)}>
        <input placeholder="Title" {...register("title")} />
        <p>{errors.title?.message}</p>

        <textarea placeholder="Description" {...register("description")} />
        <p>{errors.description?.message}</p>

        <select {...register("severity")}>
          <option value="">Select Severity</option>
          <option value="LOW">LOW</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="HIGH">HIGH</option>
          <option value="CRITICAL">CRITICAL</option>
        </select>

        <select {...register("priority")}>
          <option value="">Select Priority</option>
          <option value="P3_LOW">P3_LOW</option>
          <option value="P2_MEDIUM">P2_MEDIUM</option>
          <option value="P1_URGENT">P1_URGENT</option>
        </select>

        <input
          placeholder="Assign Developer ID"
          {...register("assignedToId")}
        />

        <input
          placeholder="TestCase ID"
          {...register("testCaseId")}
        />

        <br /><br />
        <button type="submit">Create Bug</button>
      </form>
    </div>
  )
}
