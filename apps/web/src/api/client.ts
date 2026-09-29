import type { Course, CourseDetail, Lesson } from '@type-happy/shared'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`)
  } catch {
    throw new ApiError(0, '无法连接服务端,请确认后端已启动(pnpm dev)')
  }
  if (!res.ok) {
    const message = res.status === 404 ? '内容不存在' : `请求失败(${res.status})`
    throw new ApiError(res.status, message)
  }
  return (await res.json()) as T
}

export function fetchCourses(): Promise<Course[]> {
  return request<Course[]>('/courses')
}

export function fetchCourse(courseId: string): Promise<CourseDetail> {
  return request<CourseDetail>(`/courses/${encodeURIComponent(courseId)}`)
}

export function fetchLesson(courseId: string, lessonId: string): Promise<Lesson> {
  return request<Lesson>(
    `/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}`,
  )
}
