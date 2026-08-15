(function () {
	'use strict';

	var SUPABASE_URL = 'https://ncggnnalnlbpxkweknda.supabase.co';
	var SUPABASE_KEY = 'sb_publishable_WHC6x2pYjkUHgGTStfDxJg_xooy-FUR';
	var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
	var posts = [];
	var currentUser = null;

	var list = document.getElementById('post-list');
	var count = document.getElementById('post-count');
	var boardStatus = document.getElementById('board-status');
	var adminPanel = document.getElementById('admin-panel');
	var loginView = document.getElementById('login-view');
	var editorView = document.getElementById('editor-view');
	var adminStatus = document.getElementById('admin-status');
	var dialog = document.getElementById('post-dialog');

	function setStatus(element, message, isError) {
		element.textContent = message || '';
		element.style.color = isError ? '#c94343' : '';
	}

	function formatDate(value) {
		return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
	}

	function create(tag, className, text) {
		var element = document.createElement(tag);
		if (className) element.className = className;
		if (text !== undefined) element.textContent = text;
		return element;
	}

	function renderPosts() {
		list.replaceChildren();
		count.textContent = '총 ' + posts.length + '개의 자료';
		if (!posts.length) {
			list.appendChild(create('div', 'board-status', '등록된 자료가 없습니다.'));
			return;
		}
		posts.forEach(function (post, index) {
			var row = create('article', 'post-item');
			row.tabIndex = 0;
			row.setAttribute('role', 'button');
			row.setAttribute('aria-label', post.title + ' 열기');
			row.appendChild(create('span', 'post-number', String(posts.length - index)));
			var title = create('span', 'post-title');
			if (post.is_pinned) title.appendChild(create('span', 'pin', '공지'));
			title.appendChild(document.createTextNode(post.title));
			row.appendChild(title);
			row.appendChild(create('time', 'post-date', formatDate(post.created_at)));
			var fileMark = create('span', 'post-file-mark');
			fileMark.innerHTML = post.file_url ? '<i class="fas fa-paperclip" aria-label="첨부파일 있음"></i>' : '';
			row.appendChild(fileMark);
			row.addEventListener('click', function () { openPost(post); });
			row.addEventListener('keydown', function (event) { if (event.key === 'Enter' || event.key === ' ') openPost(post); });
			if (currentUser) {
				var remove = create('button', 'post-delete', '삭제');
				remove.type = 'button';
				remove.addEventListener('click', function (event) { event.stopPropagation(); deletePost(post); });
				fileMark.replaceChildren(remove);
			}
			list.appendChild(row);
		});
	}

	function openPost(post) {
		var detail = document.getElementById('post-detail');
		detail.replaceChildren();
		detail.appendChild(create('h2', '', post.title));
		detail.appendChild(create('p', 'detail-meta', formatDate(post.created_at)));
		detail.appendChild(create('div', 'detail-content', post.content));
		if (post.file_url) {
			var fileBox = create('div', 'detail-file');
			var link = create('a', '', '첨부파일 다운로드 · ' + (post.file_name || '파일'));
			link.href = post.file_url;
			link.target = '_blank';
			link.rel = 'noopener';
			fileBox.appendChild(link);
			detail.appendChild(fileBox);
		}
		dialog.showModal();
	}

	async function loadPosts() {
		setStatus(boardStatus, '자료를 불러오는 중입니다.');
		var result = await client.from('board_posts').select('*').order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
		if (result.error) {
			setStatus(boardStatus, '자료실 설정이 아직 완료되지 않았습니다.', true);
			count.textContent = '자료실 준비 중';
			return;
		}
		posts = result.data || [];
		setStatus(boardStatus, '');
		renderPosts();
	}

	async function refreshSession() {
		var result = await client.auth.getSession();
		currentUser = result.data.session ? result.data.session.user : null;
		loginView.hidden = !!currentUser;
		editorView.hidden = !currentUser;
		renderPosts();
	}

	document.getElementById('admin-toggle').addEventListener('click', function () {
		adminPanel.hidden = !adminPanel.hidden;
	});

	document.getElementById('login-form').addEventListener('submit', async function (event) {
		event.preventDefault();
		setStatus(adminStatus, '로그인 중입니다.');
		var result = await client.auth.signInWithPassword({ email: document.getElementById('admin-email').value, password: document.getElementById('admin-password').value });
		if (result.error) return setStatus(adminStatus, '로그인 정보를 확인해 주세요.', true);
		setStatus(adminStatus, '로그인되었습니다.');
		await refreshSession();
	});

	document.getElementById('logout-button').addEventListener('click', async function () {
		await client.auth.signOut();
		setStatus(adminStatus, '로그아웃되었습니다.');
		await refreshSession();
	});

	document.getElementById('post-form').addEventListener('submit', async function (event) {
		event.preventDefault();
		var form = event.currentTarget;
		var file = document.getElementById('post-file').files[0];
		if (file && file.size > 20 * 1024 * 1024) return setStatus(adminStatus, '첨부파일은 20MB 이하만 등록할 수 있습니다.', true);
		setStatus(adminStatus, '자료를 등록하는 중입니다.');
		var fileName = null, fileUrl = null, filePath = null;
		if (file) {
			filePath = Date.now() + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
			var upload = await client.storage.from('resources').upload(filePath, file, { upsert: false });
			if (upload.error) return setStatus(adminStatus, '파일 업로드에 실패했습니다: ' + upload.error.message, true);
			fileName = file.name;
			fileUrl = client.storage.from('resources').getPublicUrl(filePath).data.publicUrl;
		}
		var insert = await client.from('board_posts').insert({ title: document.getElementById('post-title').value.trim(), content: document.getElementById('post-content').value.trim(), file_name: fileName, file_url: fileUrl, file_path: filePath, is_pinned: document.getElementById('post-pinned').checked });
		if (insert.error) return setStatus(adminStatus, '게시글 등록에 실패했습니다: ' + insert.error.message, true);
		form.reset();
		setStatus(adminStatus, '자료가 등록되었습니다.');
		await loadPosts();
	});

	async function deletePost(post) {
		if (!window.confirm('이 자료를 삭제하시겠습니까?')) return;
		if (post.file_path) await client.storage.from('resources').remove([post.file_path]);
		var result = await client.from('board_posts').delete().eq('id', post.id);
		if (result.error) return setStatus(boardStatus, '삭제에 실패했습니다.', true);
		await loadPosts();
	}

	document.getElementById('dialog-close').addEventListener('click', function () { dialog.close(); });
	dialog.addEventListener('click', function (event) { if (event.target === dialog) dialog.close(); });
	client.auth.onAuthStateChange(function () { window.setTimeout(refreshSession, 0); });
	loadPosts();
	refreshSession();
})();
