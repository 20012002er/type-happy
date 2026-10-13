<template>
  <CommonModal
    v-model="modalVisible"
    title="角色资料"
    :icon="User"
    :width="480"
    :show-footer="true"
    confirm-text="保存"
    @close="close"
    @confirm="save"
  >
    <template #default>
      <!-- 头像选择 -->
      <div class="form-group">
        <label class="form-label">选择头像</label>
        <div class="avatar-grid">
          <button
            v-for="avatar in avatarOptions"
            :key="avatar.id"
            class="avatar-option"
            :class="{ selected: localAvatar === avatar.id }"
            @click="localAvatar = avatar.id"
          >
            <component :is="avatar.icon" class="avatar-icon" />
          </button>
        </div>
      </div>

      <!-- 名称输入 -->
      <div class="form-group">
        <label class="form-label">角色名称</label>
        <input
          v-model="localName"
          type="text"
          class="form-input"
          placeholder="请输入角色名称"
          maxlength="12"
          @keyup.enter="save"
        />
        <div class="form-hint">最多12个字符</div>
      </div>

      <!-- 预览 -->
      <div class="form-group">
        <label class="form-label">预览</label>
        <div class="profile-preview">
          <div class="preview-avatar">
            <component :is="currentAvatarIcon" class="avatar-icon" />
          </div>
          <span class="preview-name">{{ localName || '无名侠客' }}</span>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="preset-buttons">
        <button class="action-btn cancel-btn" @click="close">取消</button>
        <button class="action-btn confirm-btn" @click="save" :disabled="!localName.trim()">保存</button>
      </div>
    </template>
  </CommonModal>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { User, Shirt, Skull, Sword, Shield, Crosshair, Theater, Ghost, Glasses, Crown, CircleUser, Baby, Hexagon, Circle, Sparkles } from 'lucide-vue-next';
import CommonModal from './common/CommonModal.vue';

interface Props {
  visible: boolean;
  currentName: string;
  currentAvatar: string;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'close'): void;
  (e: 'save', data: { name: string; avatar: string }): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// 本地编辑状态
const localName = ref(props.currentName);
const localAvatar = ref(props.currentAvatar);

// 计算属性：控制CommonModal显示
const modalVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:modelValue', value),
});

// 当前选中的头像图标
const currentAvatarIcon = computed(() => {
  const avatar = avatarOptions.find(a => a.id === localAvatar.value);
  return avatar?.icon || CircleUser;
});

// 可选的头像图标列表（武侠风格）
const avatarOptions = [
  { id: 'ninja', icon: Shirt, label: '忍者' },
  { id: 'mage', icon: Sparkles, label: '法师' },
  { id: 'hero', icon: Skull, label: '超级英雄' },
  { id: 'person', icon: CircleUser, label: '剪影' },
  { id: 'sword', icon: Sword, label: '剑' },
  { id: 'shield', icon: Shield, label: '盾牌' },
  { id: 'crosshair', icon: Crosshair, label: '弓箭' },
  { id: 'mask', icon: Theater, label: '面具' },
  { id: 'demon', icon: Ghost, label: '妖怪' },
  { id: 'cool', icon: Glasses, label: '墨镜' },
  { id: 'cowboy', icon: Crown, label: '牛仔' },
  { id: 'man', icon: User, label: '男人' },
  { id: 'woman', icon: CircleUser, label: '女人' },
  { id: 'adult', icon: CircleUser, label: '人' },
  { id: 'child', icon: Baby, label: '婴儿' },
  { id: 'elder', icon: Circle, label: '老人' },
  { id: 'dragon', icon: Hexagon, label: '龙' },
  { id: 'eagle', icon: Hexagon, label: '鹰' },
  { id: 'owl', icon: Circle, label: '猫头鹰' },
];

// 计算属性
const isVisible = ref(props.visible);

// 监听props变化
watch(() => props.visible, (newVal) => {
  isVisible.value = newVal;
  if (newVal) {
    // 重新初始化本地状态
    localName.value = props.currentName;
    localAvatar.value = props.currentAvatar;
  }
});

watch(() => props.currentName, (newVal) => {
  localName.value = newVal;
});

watch(() => props.currentAvatar, (newVal) => {
  localAvatar.value = newVal;
});

// 方法
function close() {
  emit('close');
}

function save() {
  const trimmedName = localName.value.trim();
  if (!trimmedName) {
    return;
  }

  emit('save', {
    name: trimmedName,
    avatar: localAvatar.value
  });

  close();
}
</script>

<style scoped>
.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #111;
  margin-bottom: 8px;
}

.avatar-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
  gap: 6px;
}

.avatar-option {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.1);
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 8px;
  padding: 8px;
}

.avatar-icon {
  width: 24px;
  height: 24px;
  color: #333;
}

.avatar-option:hover {
  background: rgba(17, 17, 17, 0.04);
  border-color: rgba(17, 17, 17, 0.2);
  transform: scale(1.1);
}

.avatar-option.selected {
  background: #111;
  border-color: #111;
  border-width: 2px;
  transform: scale(1.1);
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  font-size: 14px;
  color: #111;
  background: #fff;
  border: 1px solid rgba(17, 17, 17, 0.15);
  transition: border-color 0.2s ease;
  border-radius: 8px;
}

.form-input:focus {
  outline: none;
  border-color: #111;
  border-width: 2px;
}

.form-hint {
  margin-top: 4px;
  font-size: 12px;
  color: rgba(17, 17, 17, 0.6);
}

.profile-preview {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: rgba(17, 17, 17, 0.03);
  border-radius: 12px;
}

.preview-avatar {
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(17, 17, 17, 0.05);
  border-radius: 12px;
}

.preview-avatar .avatar-icon {
  width: 36px;
  height: 36px;
  color: #333;
}

.preview-name {
  font-size: 20px;
  font-weight: 700;
  color: #111;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  width: 100%;
}

.btn {
  flex: 1;
  max-width: 160px;
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border-radius: 10px;
  transition: all 0.2s ease;
}

.btn-secondary {
  background: rgba(17, 17, 17, 0.06);
  color: #666;
  border: 1px solid rgba(17, 17, 17, 0.15);
}

.btn-secondary:hover {
  background: rgba(17, 17, 17, 0.1);
}

.btn-primary {
  background: #111;
  color: #fff;
  border: none;
}

.btn-primary:hover:not(:disabled) {
  background: #333;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
