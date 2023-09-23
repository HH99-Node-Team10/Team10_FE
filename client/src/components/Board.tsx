import { useCallback, useEffect, useState } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "react-beautiful-dnd";
import { useQuery } from "react-query";
import { useParams } from "react-router-dom";
import { addNewColumnAPI, getColumnsAPI } from "../api/boardAPI";
import { deleteAPI, putAPI } from "../axios";
import { io, Socket } from "socket.io-client";
import { TCard, TColumn } from "../types/dnd";
import { getCardStyle, getColumnStyle } from "../utils/dnd";
import BoardHeader from "./BoardHeader";
import NewColumnInput from "./NewColumnInput";
import RightSidebar from "./layouts/RightSidebar";
import { useRecoilValue } from "recoil";
import { userWorkspacesBoardsState } from "../states/userInfoState";
import { getBoardBackgroundStyle } from "../utils/boardStyles";
import { LuDelete } from "react-icons/lu";

type BoardProps = {
  boardId: string;
  openModal: () => void;
};

function Board({ boardId, openModal }: BoardProps) {
  const { workspaceId } = useParams();

  const [columns, setColumns] = useState<TColumn[]>([]);
  const [rightSidebarOpen, setRightSidebarOpen] = useState<boolean>(false);
  const [isInputMode, setInputMode] = useState<boolean>(false);
  const [columnName, setColumnName] = useState<string>("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [editedColumnName, setEditedColumnName] = useState("");
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const userWorkspacesBoards = useRecoilValue(userWorkspacesBoardsState);

  const findBoardById = (boards: any[], id: string) => {
    for (const workspace of boards) {
      const foundBoard = workspace.Boards.find(
        (board: any) => board.boardId.toString() === id
      );
      if (foundBoard) return foundBoard;
    }
    return null;
  };
  const board = findBoardById(userWorkspacesBoards, boardId);

  // socket연결
  useEffect(() => {
    const newSocket = io(`${process.env.REACT_APP_SERVER_URL!}/board`, {
      path: "/socket.io",
    });
    newSocket.emit("join", boardId);
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [boardId]);

  // Column 추가 기능
  const addColumn = useCallback(
    (columnId: number, columnName: string, columnOrder: number) => {
      const newColumn = {
        columnId: `${columnId}`,
        columnName: columnName,
        columnOrder: columnOrder,
        cards: [],
      };
      setColumns([...columns, newColumn]);
    },
    [columns]
  );

  useEffect(() => {
    if (!socket) return;
    socket.on("changeToClient", ({ columnId, columnOrder, columnName }) => {
      setColumns((prevColumns) => {
        const updatedColumns = prevColumns.map((column) => {
          if (column.columnId === columnId) {
            return { ...column, columnOrder, columnName };
          }
          return column;
        });
        console.log(updatedColumns);
        return updatedColumns.sort((a, b) => a.columnOrder - b.columnOrder);
      });
    });

    socket.on("addToClient", (data) => {
      addColumn(data.columnId, data.columnName, data.columnOrder);
    });

    socket.on("deleteToClient", ({ columnId }) => {
      setColumns((prevColumns) => {
        return prevColumns.filter((column) => column.columnId !== columnId);
      });
    });

    return () => {
      socket.off("changeToClient");
      socket.off("addToClient");
      socket.off("deleteToClient");
    };
  }, [socket, columns, addColumn]);

  const {
    data: fetchedColumns,
    refetch,
    isLoading,
  } = useQuery(
    ["columns", workspaceId, boardId],
    () => getColumnsAPI(workspaceId!, boardId),
    {
      enabled: false,
    }
  );

  useEffect(() => {
    refetch().then(() => {
      if (fetchedColumns) {
        const sanitizedColumns = fetchedColumns.map((col: any) => ({
          ...col,
          cards: Array.isArray(col.cards) ? col.cards : [],
        }));
        setColumns(sanitizedColumns);
      }
    });
  }, [workspaceId, boardId, refetch, fetchedColumns]);

  const addNewColumn = async () => {
    const column = await addNewColumnAPI(workspaceId!, boardId, columnName);
    if (column) {
      addColumn(+column.columnId, columnName, column.columnOrder);
      setInputMode(false);
      setColumnName("");

      if (socket) {
        socket.emit("addToServer", {
          columnId: column.columnId,
          columnName: columnName,
          columnOrder: column.columnOrder,
        });
      }
    }
  };

  const handleColumnNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditedColumnName(e.target.value);
  };

  const handleColumnUpdateOnEnter = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Enter") {
      handleColumnNameUpdate();
    }
  };

  const handleColumnNameUpdate = async () => {
    await putAPI(
      `/api/workspaces/${workspaceId}/boards/${boardId}/columns/${editingColumnId}`,
      { columnName: editedColumnName }
    );
    if (socket) {
      socket.emit("changeToServer", {
        columnId: editingColumnId,
        columnName: editedColumnName,
      });
    }
    refetch();
    setEditingColumnId(null);
  };

  const deleteColumn = async (columnId: string) => {
    console.log(columnId);
    await deleteAPI(
      `/api/workspaces/${workspaceId}/boards/${boardId}/columns/${columnId}`
    );
    if (socket) {
      socket.emit("deleteToServer", {
        columnId,
      });
    }
    refetch();
  };

  // Card 추가 기능
  const addCard = (columnId: string) => {
    const newTitle = prompt("새 카드의 제목을 입력하세요");
    if (newTitle) {
      const newCard: TCard = {
        cardId: `${Date.now()}`,
        cardName: newTitle,
      };
      setColumns(
        columns?.map((column) =>
          column.columnId === columnId
            ? { ...column, cards: [...column.cards, newCard] }
            : column
        )
      );
    }
  };

  const onDragEnd = async ({ source, destination, type }: DropResult) => {
    if (!destination) return;

    if (type === "column") {
      const reorderedColumns = Array.from(columns);
      const [movedColumn] = reorderedColumns.splice(source.index, 1);
      reorderedColumns.splice(destination.index, 0, movedColumn);
      if (
        destination.index > 0 &&
        destination.index < reorderedColumns.length - 1
      ) {
        const prevOrder = reorderedColumns[destination.index - 1].columnOrder;
        const nextOrder = reorderedColumns[destination.index + 1].columnOrder;
        movedColumn.columnOrder = (prevOrder + nextOrder) / 2;
      } else if (destination.index === 0) {
        movedColumn.columnOrder = reorderedColumns[1].columnOrder - 1;
      } else if (destination.index === reorderedColumns.length - 1) {
        movedColumn.columnOrder =
          reorderedColumns[reorderedColumns.length - 2].columnOrder + 1;
      }
      setColumns(reorderedColumns);
      if (socket) {
        socket.emit("changeToServer", {
          columnId: movedColumn.columnId,
          columnName: movedColumn.columnName,
          columnOrder: movedColumn.columnOrder,
        });
      }
      await putAPI(
        `/api/workspaces/${workspaceId}/boards/${boardId}/columns/${movedColumn.columnId}`,
        { columnOrder: movedColumn.columnOrder }
      );
      return;
    }

    const sourceColumn = columns.find(
      (column) => column.columnId === source.droppableId
    );
    const destColumn = columns.find(
      (column) => column.columnId === destination.droppableId
    );

    if (sourceColumn && destColumn) {
      if (sourceColumn.columnId === destColumn.columnId) {
        const reorderedCards = Array.from(sourceColumn.cards);
        const [movedCard] = reorderedCards.splice(source.index, 1);
        reorderedCards.splice(destination.index, 0, movedCard);
        setColumns(
          columns?.map((column) =>
            column.columnId === sourceColumn.columnId
              ? { ...column, cards: reorderedCards }
              : column
          )
        );
      } else {
        const sourceCards = Array.from(sourceColumn.cards);
        const destCards = Array.from(destColumn.cards);
        const [movedCard] = sourceCards.splice(source.index, 1);
        destCards.splice(destination.index, 0, movedCard);

        setColumns(
          columns?.map((column) =>
            column.columnId === sourceColumn.columnId
              ? { ...column, cards: sourceCards }
              : column.columnId === destColumn.columnId
              ? { ...column, cards: destCards }
              : column
          )
        );
      }
    }
  };

  // requestAnimationFrame 초기화
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const animation = requestAnimationFrame(() => setEnabled(true));
    return () => {
      cancelAnimationFrame(animation);
      setEnabled(false);
    };
  }, []);

  if (!enabled) {
    return null;
  }

  if (isLoading) {
    return <div>로딩 중...</div>;
  }

  const backgroundStyle = getBoardBackgroundStyle(board);

  return (
    <div className="h-full w-full flex flex-col" style={backgroundStyle}>
      <BoardHeader
        boardName={board?.boardName}
        toggleSidebar={() => setRightSidebarOpen(!rightSidebarOpen)}
      />

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable
          droppableId="all-columns"
          direction="horizontal"
          type="column"
        >
          {(provided) => (
            <div
              className="flex gap-2 p-4"
              ref={provided.innerRef}
              {...provided.droppableProps}
            >
              {columns?.map((column, index) => (
                <Draggable
                  key={column.columnId}
                  draggableId={column.columnId}
                  index={index}
                >
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                    >
                      <Droppable
                        droppableId={column.columnId}
                        key={column.columnId}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            style={{
                              ...getColumnStyle(snapshot.isDraggingOver),
                            }}
                          >
                            {editingColumnId === column.columnId ? (
                              <input
                                autoFocus
                                value={editedColumnName}
                                onBlur={handleColumnNameUpdate}
                                onChange={handleColumnNameChange}
                                onKeyDown={handleColumnUpdateOnEnter}
                                className="w-full h-8 px-2 bg-[#22272B] rounded-md mb-2 text-white outline-none"
                              />
                            ) : (
                              <h2 className="text-white mb-2 h-8 flex items-center px-2 w-full justify-between">
                                <div
                                  className="w-full"
                                  onClick={() => {
                                    setEditingColumnId(column.columnId);
                                    setEditedColumnName(column.columnName);
                                  }}
                                >
                                  {column.columnName}
                                </div>
                                <button
                                  onClick={(e) => deleteColumn(column.columnId)}
                                >
                                  <LuDelete />
                                </button>
                              </h2>
                            )}
                            {column.cards?.map((card, index) => (
                              <Draggable
                                key={card.cardId}
                                draggableId={card.cardId}
                                index={index}
                              >
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    style={{
                                      ...getCardStyle(
                                        snapshot.isDragging,
                                        provided.draggableProps.style || {}
                                      ),
                                    }}
                                  >
                                    {card.cardName}
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            <button
                              onClick={() => addCard(column.columnId)}
                              className="bg-white py-2 w-[288px] rounded text-black"
                            >
                              +
                            </button>
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  )}
                </Draggable>
              ))}
              <NewColumnInput
                isInputMode={isInputMode}
                columnName={columnName}
                setColumnName={setColumnName}
                addNewColumn={addNewColumn}
                toggleInputMode={() => setInputMode(!isInputMode)}
              />
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      {rightSidebarOpen && (
        <RightSidebar
          closeSidebar={() => setRightSidebarOpen(false)}
          isOpen={rightSidebarOpen}
          openModal={openModal}
        />
      )}
    </div>
  );
}
export default Board;
