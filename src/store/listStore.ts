import { create } from 'zustand';

import type { Restaurant } from '../lib/types';

export type ModalForm = { name: string; category: string; phone: string; memo: string };
export type ModalState = { mode: 'new' | 'edit'; id?: string; form: ModalForm; err: string };
export type EditMenu = { id: string; name: string; price: string };

type ListState = {
  search: string;
  sort: 'cat' | 'name';
  listMode: 'card' | 'table';
  cat: string;
  selId: string | null;
  confirmDel: boolean;
  editMenu: EditMenu | null;
  menuForm: { name: string; price: string };
  modal: ModalState | null;

  setSearch: (v: string) => void;
  setSort: (v: 'cat' | 'name') => void;
  setListMode: (v: 'card' | 'table') => void;
  setCat: (v: string) => void;
  /** 카드/행을 눌러 상세 드로어를 연다. 드로어 안의 임시 상태를 모두 초기화한다. */
  openDetail: (id: string) => void;
  closeDetail: () => void;
  setConfirmDel: (v: boolean) => void;
  setEditMenu: (v: EditMenu | null) => void;
  setMenuForm: (p: Partial<{ name: string; price: string }>) => void;
  resetMenuForm: () => void;

  openNew: () => void;
  openEdit: (r: Restaurant) => void;
  setForm: (p: Partial<ModalForm>) => void;
  setModalErr: (err: string) => void;
  closeModal: () => void;
};

export const useList = create<ListState>((set) => ({
  search: '',
  sort: 'cat',
  listMode: 'card',
  cat: '전체',
  selId: null,
  confirmDel: false,
  editMenu: null,
  menuForm: { name: '', price: '' },
  modal: null,

  setSearch: (search) => set({ search }),
  setSort: (sort) => set({ sort }),
  setListMode: (listMode) => set({ listMode }),
  setCat: (cat) => set({ cat }),

  openDetail: (selId) =>
    set({ selId, confirmDel: false, editMenu: null, menuForm: { name: '', price: '' } }),
  closeDetail: () => set({ selId: null, confirmDel: false, editMenu: null }),
  setConfirmDel: (confirmDel) => set({ confirmDel }),
  setEditMenu: (editMenu) => set({ editMenu }),
  setMenuForm: (p) => set((s) => ({ menuForm: { ...s.menuForm, ...p } })),
  resetMenuForm: () => set({ menuForm: { name: '', price: '' } }),

  openNew: () =>
    set({ modal: { mode: 'new', form: { name: '', category: '한식', phone: '', memo: '' }, err: '' } }),
  openEdit: (r) =>
    set({
      modal: {
        mode: 'edit',
        id: r.id,
        form: { name: r.name, category: r.category, phone: r.phone, memo: r.memo || '' },
        err: '',
      },
    }),
  setForm: (p) =>
    set((s) => (s.modal ? { modal: { ...s.modal, form: { ...s.modal.form, ...p }, err: '' } } : s)),
  setModalErr: (err) => set((s) => (s.modal ? { modal: { ...s.modal, err } } : s)),
  closeModal: () => set({ modal: null }),
}));
