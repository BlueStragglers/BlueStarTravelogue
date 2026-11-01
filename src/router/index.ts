import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  // hash 模式：静态托管（GitHub Pages / Netlify / 本地 http.server）都无需服务端回退配置
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/today' },
    {
      path: '/today',
      name: 'today',
      component: () => import('@/views/TodayView.vue'),
    },
    {
      path: '/tracks',
      name: 'tracks',
      component: () => import('@/views/TracksView.vue'),
    },
    {
      path: '/review',
      name: 'review',
      component: () => import('@/views/ReviewView.vue'),
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('@/views/ProfileView.vue'),
    },
    {
      path: '/day/:id',
      name: 'day',
      component: () => import('@/views/DayDetailView.vue'),
    },
    {
      path: '/location/:id',
      name: 'location',
      component: () => import('@/views/LocationDetailView.vue'),
    },
    {
      path: '/photos',
      name: 'photos',
      component: () => import('@/views/PhotoGalleryView.vue'),
    },
    {
      path: '/photo/:id',
      name: 'photo',
      component: () => import('@/views/PhotoViewerView.vue'),
    },
    {
      path: '/entry',
      name: 'entry',
      component: () => import('@/views/ManualEntryView.vue'),
    },
    {
      path: '/locations',
      name: 'locations',
      component: () => import('@/views/LocationDirectoryView.vue'),
    },
    {
      path: '/settings/:section?',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
    },
    { path: '/:pathMatch(.*)*', redirect: '/today' },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

export default router
