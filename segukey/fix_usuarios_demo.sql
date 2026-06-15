-- ============================================================
-- fix_usuarios_demo.sql
-- Corrige los hashes de contraseña de los usuarios demo
-- (los del seed original eran placeholders inválidos).
-- Ejecutar contra la BD de Supabase/Postgres ya existente.
-- ============================================================

UPDATE usuario SET contrasena = '$2a$10$chnvLZt/8/DXM0ED/ni7DuopDVUvoxgq5WuvYROf/chOceL9pJjki' -- 'Admin123!'
WHERE correo = 'admin@segukey.com';

UPDATE usuario SET contrasena = '$2a$10$AXu5ZpU/cwiLv2R7STQTherDjdHtvTh.s6kBrhCFkLr3EwAf6dIOG' -- 'Emp123!'
WHERE correo = 'empleado@segukey.com';

UPDATE usuario SET contrasena = '$2a$10$r9YxBhwE0ucLRPx2Cjn5B.pWaKrwEiH74QsEimpfwx5Bh1vpJbpvC' -- 'Test123!'
WHERE correo = 'tester@segukey.com';
