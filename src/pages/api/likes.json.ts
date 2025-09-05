import type { APIRoute } from 'astro'
import { getPostBySlug, incrementLikes } from '../../lib/notion/client'

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url)
  const slug = url.searchParams.get('slug')

  if (!slug) {
    return new Response(null, { status: 400 })
  }

  const post = await getPostBySlug(slug)
  if (!post) {
    return new Response(null, { status: 404 })
  }

  return new Response(JSON.stringify({ likes: post.Like }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const POST: APIRoute = async ({ request }) => {
  const url = new URL(request.url)
  const slug = url.searchParams.get('slug')

  if (!slug) {
    return new Response(null, { status: 400 })
  }

  const post = await getPostBySlug(slug)
  if (!post) {
    return new Response(null, { status: 404 })
  }

  const updatedPost = await incrementLikes(post)
  if (!updatedPost) {
    return new Response(null, { status: 404 })
  }

  return new Response(JSON.stringify({ likes: updatedPost.Like }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}